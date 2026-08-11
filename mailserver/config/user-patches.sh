#!/bin/bash
# docker-mailserver runs this script at container startup, after it has
# generated the Dovecot config but before the mail services are serving.
# We use it to wire up a Dovecot *master passdb* so that the SSO master
# account (master_admin) can log in as any mailbox using the form
#   <email>*master_admin
# This is the piece that was missing: dovecot-master-users existed but
# nothing told Dovecot to read it, so master logins always failed.

set -e

AUTH_CONF="/etc/dovecot/conf.d/10-auth.conf"
MASTER_FILE="/tmp/docker-mailserver/dovecot-master-users"

# Once TLS is enabled, docker-mailserver sets disable_plaintext_auth = yes, which
# breaks the plain-IMAP master login that Roundcube (SSO) and the backend use on
# the internal network. Force it back off — this runs after all config gen.
if grep -qE '^\s*#?\s*disable_plaintext_auth' "${AUTH_CONF}"; then
  sed -i -E 's/^\s*#?\s*disable_plaintext_auth\s*=.*/disable_plaintext_auth = no/' "${AUTH_CONF}"
else
  echo 'disable_plaintext_auth = no' >> "${AUTH_CONF}"
fi

if [[ -f "${MASTER_FILE}" ]] && ! grep -q 'SSO master passdb' "${AUTH_CONF}"; then
  cat >> "${AUTH_CONF}" <<EOF

# --- SSO master passdb (added by user-patches.sh) ---
# Allows login as <email>*master_admin with the master password.
auth_master_user_separator = *
passdb {
  driver = passwd-file
  master = yes
  args = ${MASTER_FILE}
  # After the master authenticates, fall through to the normal userdb for
  # the target mailbox — no need for the target user's own password.
}
EOF
fi

# Reload so all of the above takes effect without a full restart.
dovecot reload 2>/dev/null || supervisorctl restart dovecot 2>/dev/null || true
