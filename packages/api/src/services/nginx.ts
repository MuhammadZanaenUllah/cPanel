import { sendPrivilegedCommand } from '../privileged/client';

export class NginxService {
  static generateVhostConfig(domain: string, documentRoot: string, phpVersion: string): string {
    return `server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};
    root ${documentRoot};
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${phpVersion}-fpm.sock;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;
  }

  static async setupDomain(domain: string, documentRoot: string, phpVersion = '8.2') {
    const content = this.generateVhostConfig(domain, documentRoot, phpVersion);
    
    // 1. Write the configuration
    await sendPrivilegedCommand('write_nginx_config', { domain, content });
    
    // 2. Enable it by symlinking
    await sendPrivilegedCommand('enable_nginx_config', { domain });
    
    // 3. Test configuration
    try {
      await sendPrivilegedCommand('test_nginx_config', {});
    } catch (err: any) {
      // If validation fails, disable the config immediately to prevent breaking Nginx
      await sendPrivilegedCommand('disable_nginx_config', { domain });
      throw new Error(`Nginx validation failed: ${err.message}`);
    }

    // 4. Reload Nginx
    await sendPrivilegedCommand('reload_nginx', {});
  }

  static async removeDomain(domain: string) {
    await sendPrivilegedCommand('delete_nginx_config', { domain });
    await sendPrivilegedCommand('reload_nginx', {});
  }
}
