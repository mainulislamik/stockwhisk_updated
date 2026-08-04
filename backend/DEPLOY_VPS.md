# Alma Linux VPS Deployment Guide for StockWhisk

This guide explains how to take your project and deploy it onto your Alma Linux VPS so that it runs on port 80.

## Step 1: Install Docker on Alma Linux
Log into your Alma Linux VPS via SSH and run these commands to install Docker and Docker Compose:

```bash
# Update the system
sudo dnf update -y

# Add the official Docker repository
sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker to run on boot
sudo systemctl enable --now docker
```

## Step 2: Transfer Your Code
You need to get the `inventory_management` folder onto your VPS. You can either:
1. Push your code to GitHub and clone it on the VPS.
2. OR Use `scp` or an FTP client (like FileZilla) to upload this folder to your VPS.

## Step 3: Configure the Environment
Once the code is on the VPS, navigate into the project directory:
```bash
cd inventory_management
```

Rename the `production.env` file (which I just created for you) to `.env`:
```bash
cp production.env .env
```

Open `.env` using a text editor like `nano`:
```bash
nano .env
```
Make sure you update:
- `SECRET_KEY`: Change to something random.
- `DB_PASSWORD`: Change to a secure password.
- `CSRF_TRUSTED_ORIGINS`: Set this to `http://your_vps_ip_address` so logins work correctly.
*(Press `Ctrl+O` then `Enter` to save, and `Ctrl+X` to exit nano)*.

## Step 4: Open Port 80 in the Firewall
Alma Linux uses `firewalld` by default. You need to allow port 80 (HTTP) traffic:
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## Step 5: Start the Application!
Run the following command to build and start the application in the background:
```bash
sudo docker compose up -d --build
```

Wait a minute for the containers to start and the database to initialize.

## Step 6: Create the Superuser
Finally, create your super admin account on the live server:
```bash
sudo docker compose exec web python manage.py createsuperuser
```

**You're done!** You can now visit your VPS's IP address in your browser (`http://YOUR_VPS_IP`), and the app will load!
