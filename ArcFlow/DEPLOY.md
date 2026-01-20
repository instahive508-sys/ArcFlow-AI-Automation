# ArcFlow Deployment Guide - Ubuntu 22.04 + Nginx

Complete guide to deploy ArcFlow on Ubuntu 22.04 using Nginx.

---

## Step 1: Prepare Server (SSH into VM)

```bash
ssh -i "/path/to/your/ssh-key.key" ubuntu@your_server_ip
```

### Install Required Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install -y nginx

# Install PHP 8.1+ with FPM and extensions
sudo apt install -y php-fpm php-cli php-curl php-json php-pdo php-mysql php-mbstring php-xml php-zip

# Verify PHP-FPM version (note this for config)
php -v
# Usually php8.1-fpm on Ubuntu 22.04
```

---

## Step 2: Create Nginx Config

```bash
# Create directory
sudo mkdir -p /var/www/html/arcflow
sudo chown -R ubuntu:www-data /var/www/html/arcflow

# Create Nginx config
sudo nano /etc/nginx/sites-available/arcflow
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Replace with your domain or IP
    
    root /var/www/html/arcflow;
    index index.html index.php landwork.html;
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Webhook routing - must come before general location
    location ~ ^/webhook(-test)?/ {
        try_files $uri /router.php$is_args$args;
    }
    
    # API routing
    location /api {
        try_files $uri /api.php$is_args$args;
    }
    
    # Main location
    location / {
        try_files $uri $uri/ /router.php$is_args$args;
    }
    
    # PHP processing
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # Deny access to sensitive files
    location ~ /\.(git|env|htaccess) {
        deny all;
    }
    
    # Storage protection (allow PHP to write but deny direct access)
    location ~ ^/storage/ {
        internal;
    }
    
    error_log /var/log/nginx/arcflow_error.log;
    access_log /var/log/nginx/arcflow_access.log;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/arcflow /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx and PHP-FPM
sudo systemctl restart nginx
sudo systemctl restart php8.1-fpm
```

---

## Step 3: Upload Files (Local Machine)

```powershell
# Upload ArcFlow (example command)
scp -i "your-key.key" -r "path/to/ArcFlow" ubuntu@your_server_ip:/tmp
```

---

## Step 4: Deploy on Server

```bash
# SSH in
ssh -i "your-key.key" ubuntu@your_server_ip

# Move files
sudo mv /tmp/ArcFlow/* /var/www/html/arcflow/

# Create storage with proper permissions
# Important: Ensure storage.json is writable
sudo touch /var/www/html/arcflow/storage.json
sudo chown www-data:www-data /var/www/html/arcflow/storage.json
sudo chmod 664 /var/www/html/arcflow/storage.json

# Initialize generic storage
echo '{"workflows":[],"credentials":[]}' | sudo tee /var/www/html/arcflow/storage.json

# Create storage files directory
sudo mkdir -p /var/www/html/arcflow/storage/files
sudo chown -R www-data:www-data /var/www/html/arcflow/storage
sudo chmod -R 775 /var/www/html/arcflow/storage

# Set file permissions
sudo chown -R ubuntu:www-data /var/www/html/arcflow
sudo find /var/www/html/arcflow -type f -exec chmod 644 {} \;
sudo find /var/www/html/arcflow -type d -exec chmod 755 {} \;

# Clean tmp
sudo rm -rf /tmp/ArcFlow

# Restart services
sudo systemctl restart nginx php8.1-fpm
```

---

## Step 5: Configure Firewall

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**Cloud Provider Firewall:**
Ensure Ingress Rules are added for:
- Port 80 (TCP)
- Port 443 (TCP)

---

## Step 6: SSL with Certbot (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run
```

---

## Step 7: Verify

```bash
# Check services
sudo systemctl status nginx php8.1-fpm

# Check logs
sudo tail -f /var/log/nginx/arcflow_error.log
```
