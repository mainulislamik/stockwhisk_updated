import os
import re
from passlib.hash import sha512_crypt

class MailServerConfigService:
    def __init__(self, config_dir=None):
        self.config_dir = config_dir or os.environ.get('MAILSERVER_CONFIG_DIR', '/app/mailserver-config')
        self.accounts_file = os.path.join(self.config_dir, 'postfix-accounts.cf')
        self.quotas_file = os.path.join(self.config_dir, 'dovecot-quotas.cf')
        # IMAP endpoint + master credentials, used to ask Dovecot for real usage.
        self.imap_host = os.environ.get('MAILSERVER_IMAP_HOST', 'mailserver')
        self.imap_port = int(os.environ.get('MAILSERVER_IMAP_PORT', '143'))
        self.master_user = os.environ.get('MAIL_MASTER_USER', 'master_admin')
        self.master_pass = os.environ.get('MAIL_MASTER_PASS', 'stockwhisk_master_2026')

    @staticmethod
    def quota_to_bytes(quota):
        """Convert a Dovecot quota string like '512M' / '2G' / '1024' to bytes.
        Returns None for unlimited (empty / falsy)."""
        if not quota:
            return None
        q = str(quota).strip().upper().replace('B', '').replace(' ', '')
        units = {'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3, 'T': 1024 ** 4}
        try:
            if q and q[-1] in units:
                return int(float(q[:-1]) * units[q[-1]])
            return int(float(q))
        except (ValueError, IndexError):
            return None

    @staticmethod
    def _imap_mailbox_name(raw):
        """Extract the mailbox name from an IMAP LIST line and return it quoted
        for use with STATUS, e.g. b'(\\HasNoChildren) "." "INBOX"' -> '"INBOX"'."""
        line = raw.decode(errors="replace") if isinstance(raw, bytes) else str(raw)
        m = re.match(r'\([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.+)$', line.strip())
        if not m:
            return None
        name = m.group(1).strip()
        if name.startswith('"') and name.endswith('"'):
            name = name[1:-1]
        if not name:
            return None
        # Escape backslashes/quotes, then wrap in quotes for the STATUS command.
        name = name.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{name}"'

    def _mailbox_used_bytes(self, email):
        """Ask Dovecot (via IMAP QUOTA, as the master user) how much this mailbox
        actually uses. Returns bytes, or None if it couldn't be determined.
        Tries plain LOGIN first, then STARTTLS (for when Dovecot refuses
        plaintext auth on an unencrypted connection)."""
        import imaplib
        import ssl
        import re as _re

        login_user = f"{email}*{self.master_user}"

        def _query(imap):
            imap.login(login_user, self.master_pass)
            # imaplib's getquotaroot is unreliable (returns [None]); instead sum
            # every folder's STATUS (SIZE), which Dovecot advertises (STATUS=SIZE)
            # and which imaplib parses cleanly.
            typ, boxes = imap.list()
            if typ != "OK" or not boxes:
                return None
            total = 0
            found = False
            for raw in boxes:
                if not raw:
                    continue
                name = self._imap_mailbox_name(raw)
                if not name:
                    continue
                try:
                    t, st = imap.status(name, "(SIZE)")
                except Exception:
                    continue
                if t == "OK" and st and st[0]:
                    data = st[0] if isinstance(st[0], bytes) else str(st[0]).encode()
                    m = _re.search(rb'SIZE\s+(\d+)', data)
                    if m:
                        total += int(m.group(1))
                        found = True
            return total if found else 0

        # 1) Plain connection (works when plaintext auth is allowed).
        try:
            imap = imaplib.IMAP4(self.imap_host, self.imap_port, timeout=5)
            try:
                return _query(imap)
            finally:
                try:
                    imap.logout()
                except Exception:
                    pass
        except Exception:
            pass

        # 2) STARTTLS fallback (Dovecot allows plaintext LOGIN once encrypted).
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            imap = imaplib.IMAP4(self.imap_host, self.imap_port, timeout=5)
            try:
                imap.starttls(ctx)
                return _query(imap)
            finally:
                try:
                    imap.logout()
                except Exception:
                    pass
        except Exception:
            return None
        
    def _ensure_files_exist(self):
        if not os.path.exists(self.config_dir):
            return False
        for filepath in [self.accounts_file, self.quotas_file]:
            if not os.path.exists(filepath):
                # Touch file if doesn't exist
                open(filepath, 'a').close()
        return True

    def hash_password(self, password):
        return "{SHA512-CRYPT}" + sha512_crypt.hash(password)

    def list_accounts(self):
        if not self._ensure_files_exist():
            return []
            
        accounts = []
        emails = set()
        
        # Read accounts
        if os.path.exists(self.accounts_file):
            with open(self.accounts_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split('|')
                        if len(parts) >= 2:
                            email = parts[0]
                            emails.add(email)
                            accounts.append({
                                'email': email,
                                'quota': None,
                            })
                            
        # Read quotas
        if os.path.exists(self.quotas_file):
            with open(self.quotas_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split(':')
                        if len(parts) == 2:
                            email, quota = parts
                            # Update quota in accounts list
                            for acc in accounts:
                                if acc['email'] == email:
                                    acc['quota'] = quota
                                    break

        # Attach real disk usage + quota-in-bytes for each account.
        for acc in accounts:
            acc['used'] = self._mailbox_used_bytes(acc['email'])
            acc['quota_bytes'] = self.quota_to_bytes(acc['quota'])
        return accounts

    def add_account(self, email, password, quota=None):
        if not self._ensure_files_exist():
            raise Exception(f"Config directory {self.config_dir} not found. Is it mounted?")
            
        hashed = self.hash_password(password)
        
        # Append to accounts
        with open(self.accounts_file, 'a') as f:
            f.write(f"{email}|{hashed}\n")
            
        # Append to quotas if provided
        if quota:
            with open(self.quotas_file, 'a') as f:
                f.write(f"{email}:{quota}\n")
                
        return True

    def update_password(self, email, password):
        if not self._ensure_files_exist():
            return False
            
        hashed = self.hash_password(password)
        lines = []
        updated = False
        
        if os.path.exists(self.accounts_file):
            with open(self.accounts_file, 'r') as f:
                lines = f.readlines()
                
            with open(self.accounts_file, 'w') as f:
                for line in lines:
                    if line.startswith(f"{email}|"):
                        f.write(f"{email}|{hashed}\n")
                        updated = True
                    else:
                        f.write(line)
        return updated

    def update_quota(self, email, quota):
        if not self._ensure_files_exist():
            return False
            
        lines = []
        updated = False
        
        if os.path.exists(self.quotas_file):
            with open(self.quotas_file, 'r') as f:
                lines = f.readlines()
                
            with open(self.quotas_file, 'w') as f:
                for line in lines:
                    if line.startswith(f"{email}:"):
                        f.write(f"{email}:{quota}\n")
                        updated = True
                    else:
                        f.write(line)
                        
        if not updated and quota:
            # If quota didn't exist, append it
            with open(self.quotas_file, 'a') as f:
                f.write(f"{email}:{quota}\n")
                updated = True
                
        return updated

    def delete_account(self, email):
        if not self._ensure_files_exist():
            return False
            
        # Remove from accounts
        if os.path.exists(self.accounts_file):
            with open(self.accounts_file, 'r') as f:
                lines = f.readlines()
            with open(self.accounts_file, 'w') as f:
                for line in lines:
                    if not line.startswith(f"{email}|"):
                        f.write(line)
                        
        # Remove from quotas
        if os.path.exists(self.quotas_file):
            with open(self.quotas_file, 'r') as f:
                lines = f.readlines()
            with open(self.quotas_file, 'w') as f:
                for line in lines:
                    if not line.startswith(f"{email}:"):
                        f.write(line)
                        
        return True
