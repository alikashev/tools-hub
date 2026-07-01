-- Tool Hub Seed Data

-- Default modules
INSERT INTO modules (key_name, name, icon, description, sort_order) VALUES
('command-hub', 'Command Hub', 'fas fa-terminal', 'Store and manage Linux commands', 1),
('password-manager', 'Password Manager', 'fas fa-key', 'Manage passwords securely', 2),
('api-tester', 'API Tester', 'fas fa-plug', 'Test API endpoints', 3),
('server-monitor', 'Server Monitor', 'fas fa-server', 'Monitor server status', 4),
('docker-manager', 'Docker Manager', 'fab fa-docker', 'Manage Docker containers', 5),
('ssh-manager', 'SSH Manager', 'fas fa-network-wired', 'Manage SSH connections', 6),
('script-library', 'Script Library', 'fas fa-code', 'Store and manage scripts', 7),
('notes', 'Notes', 'fas fa-sticky-note', 'Take and organize notes', 8),
('db-query', 'Database Query Tool', 'fas fa-database', 'Run database queries', 9);

-- Sample categories for Command Hub
INSERT INTO categories (module_id, name, color, sort_order) VALUES
(1, 'File Operations', '#0d6efd', 1),
(1, 'System Info', '#198754', 2),
(1, 'Network', '#0dcaf0', 3),
(1, 'Process Management', '#fd7e14', 4),
(1, 'Package Management', '#6f42c1', 5),
(1, 'Permissions', '#dc3545', 6),
(1, 'Archives', '#20c997', 7),
(1, 'Text Processing', '#e83e8c', 8),
(1, 'Disk Management', '#6610f2', 9),
(1, 'Docker', '#0d6efd', 10);

-- Sample commands
INSERT INTO commands (category_id, title, command, description) VALUES
(1, 'List files with details', 'ls -lah', 'List all files in current directory with human-readable sizes'),
(1, 'Copy file with progress', 'rsync -avh --progress source destination', 'Copy files showing progress information'),
(1, 'Find large files', 'find / -type f -size +100M -exec ls -lh {} \\; 2>/dev/null', 'Find all files larger than 100MB'),
(2, 'Disk usage summary', 'df -h', 'Show disk usage in human-readable format'),
(2, 'Memory usage', 'free -h', 'Display RAM usage in human-readable format'),
(2, 'System uptime', 'uptime', 'Show how long the system has been running'),
(2, 'CPU info', 'lscpu', 'Display detailed CPU architecture information'),
(3, 'Check open ports', 'ss -tuln', 'List all listening ports and active connections'),
(3, 'Trace route', 'traceroute -n example.com', 'Trace network path to a host'),
(3, 'DNS lookup', 'nslookup example.com', 'Query DNS records for a domain'),
(4, 'List processes', 'ps aux --sort=-%mem', 'Show all running processes sorted by memory usage'),
(4, 'Kill by name', 'pkill -f "process-name"', 'Kill all processes matching a name pattern'),
(4, 'Monitor in real-time', 'htop', 'Interactive process viewer'),
(5, 'Update all packages', 'sudo apt update && sudo apt upgrade -y', 'Update all system packages (Debian/Ubuntu)'),
(5, 'Install package', 'sudo apt install -y package-name', 'Install a package (Debian/Ubuntu)'),
(6, 'Change file permissions', 'chmod 755 file.sh', 'Make a script executable'),
(6, 'Change owner', 'chown user:group filename', 'Change file owner and group'),
(7, 'Create tar archive', 'tar -czvf archive.tar.gz /path/to/dir', 'Create a compressed archive'),
(7, 'Extract tar archive', 'tar -xzvf archive.tar.gz', 'Extract a compressed archive'),
(8, 'Search with grep', 'grep -rn "pattern" /path/to/search', 'Recursively search for a pattern in files'),
(8, 'Count lines in files', 'wc -l filename', 'Count number of lines in a file'),
(9, 'Check disk I/O', 'iostat -x 1', 'Monitor disk I/O statistics in real-time'),
(9, 'List mounted filesystems', 'mount | column -t', 'Show all mounted filesystems in aligned columns');

-- Sample email snippets
INSERT INTO snippets (title, content) VALUES
('Thank you for your inquiry', 'Dear [Client Name],

Thank you for reaching out. I have received your inquiry and will get back to you within 24 hours with a detailed response.

If you have any urgent concerns, please don''t hesitate to let me know.

Best regards,
[Your Name]'),
('Payment received confirmation', 'Dear [Client Name],

Thank you for your payment. We have received it successfully and your account is now up to date.

Please find the receipt attached for your records. If you have any questions regarding the payment, feel free to reach out.

Best regards,
[Your Name]'),
('Project update', 'Dear [Client Name],

Here is a quick update on the current status of your project:

- Task 1: Completed
- Task 2: In progress
- Task 3: Scheduled for next week

We are on track to meet the expected deadline. I will keep you posted on any developments.

Best regards,
[Your Name]');
