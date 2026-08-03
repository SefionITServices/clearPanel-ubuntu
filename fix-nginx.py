import re, os, subprocess

paths = ["/etc/nginx/sites-available/clearpanel", "/etc/nginx/conf.d/clearpanel.conf"]
config_path = next((p for p in paths if os.path.exists(p)), None)

if not config_path:
    print("Nginx config not found.")
    exit(1)

with open(config_path, "r") as f:
    content = f.read()

# Replace the nested location block with the flattened one
pattern = re.compile(r"location \/ \{\s*try_files [^;]+;\s*(?:#.*?\n\s*)?location ~\* \\\.\(js.*?\}\s*\}", re.DOTALL)
replacement = """location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }"""

new_content = pattern.sub(replacement, content)

with open(config_path, "w") as f:
    f.write(new_content)

print(f"Fixed {config_path}. Reloading Nginx...")
subprocess.run(["nginx", "-t"], check=True)
subprocess.run(["systemctl", "reload", "nginx"], check=True)
print("Done! You can now refresh the panel.")
