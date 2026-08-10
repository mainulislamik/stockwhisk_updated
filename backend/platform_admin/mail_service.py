import os
import re
from passlib.hash import sha512_crypt

class MailServerConfigService:
    def __init__(self, config_dir=None):
        self.config_dir = config_dir or os.environ.get('MAILSERVER_CONFIG_DIR', '/app/mailserver-config')
        self.accounts_file = os.path.join(self.config_dir, 'postfix-accounts.cf')
        self.quotas_file = os.path.join(self.config_dir, 'dovecot-quotas.cf')
        
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
                                'quota': None
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
