---
author: stackbug
pubDatetime: 2025-03-02T00:00:00+08:00
title: Linux 常用命令实战指南：从业务场景出发
slug: linux-commands-practical-guide
featured: false
draft: false
tags:
  - linux
  - devops
  - tutorial
description: 面向后端开发的 Linux 常用命令实战清单：日志排查、网络、磁盘、进程、权限。
---

### 目录

1. 日常运维管理
2. 文件与数据处理
3. 系统监控与故障排查
4. 网络配置与诊断
5. 自动化运维实战

### 1. 日常运维管理

#### 1.1 用户与权限管理

用户和权限管理是企业安全的基础：

```bash
# 创建新的运维用户
sudo useradd -m -s /bin/bash devops

# 设置密码
sudo passwd devops

# 将用户添加到sudo组
sudo usermod -aG sudo devops

# 创建开发团队组并添加用户
sudo groupadd developers
sudo usermod -aG developers developer1
sudo usermod -aG developers developer2

# 设置项目目录权限
sudo mkdir -p /var/www/project
sudo chown -R www-data:developers /var/www/project
sudo chmod -R 775 /var/www/project
sudo chmod g+s /var/www/project  # 新文件自动继承组权限

# 查看用户所属组
groups devops

# 临时提升权限执行命令
sudo -u www-data php artisan migrate

# 查看文件权限
ls -la /var/www/project/

# 使用访问控制列表(ACL)进行更精细的权限控制
sudo setfacl -m u:developer3:rwx /var/www/project/
sudo getfacl /var/www/project/

```

业务场景：在Web应用开发环境中，开发人员需要对网站文件有写权限，而web服务器进程需要读取权限。通过组权限和ACL，可以在保证安全的前提下实现灵活的权限控制。

#### 1.2 服务管理与部署

现代Linux系统主要使用systemd管理服务，以下是管理企业应用服务的常用命令：

```bash
# 查看所有服务状态
systemctl list-units --type=service

# 检查特定服务状态（如Nginx）
systemctl status nginx

# 启动服务
sudo systemctl start nginx

# 停止服务
sudo systemctl stop mysql

# 重启服务
sudo systemctl restart php7.4-fpm

# 重新加载配置（不中断服务）
sudo systemctl reload nginx

# 设置开机自启
sudo systemctl enable redis

# 禁用开机自启
sudo systemctl disable memcached

# 查看服务日志
journalctl -u nginx

# 查看服务最近的日志
journalctl -u mysql --since today

# 查看启动失败的服务
systemctl --failed

# 创建自定义服务（例如Node.js应用）
cat > /etc/systemd/system/node-app.service << EOF
[Unit]
Description=Node.js Application
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/node-app
ExecStart=/usr/bin/node app.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd，使新服务配置生效
sudo systemctl daemon-reload

```

业务场景：部署一个包含Nginx、MySQL、Redis和Node.js应用的全栈应用时，需要确保各组件正确启动、监控其状态并设置合理的重启策略。

#### 1.3 磁盘管理与配额

管理服务器存储空间是日常运维的一部分：

```text
# 查看磁盘使用情况
df -h

# 查看特定目录的磁盘使用量
du -sh /var/www

# 查找占用空间最大的目录
du -h /var | sort -rh | head -10

# 查看当前目录下大文件
find . -type f -size +100M -exec ls -lh {} \;

# 查找并删除旧日志文件（7天前）
find /var/log -name "*.log" -type f -mtime +7 -exec rm {} \;

# 设置用户磁盘配额（需先安装quota工具）
sudo apt install quota
sudo setquota -u developer1 1000000 1200000 0 0 /home

# 查看用户配额使用情况
quota -v developer1

# 清理系统中的临时文件
sudo apt clean
sudo apt autoremove

# 使用logrotate管理日志文件
cat > /etc/logrotate.d/app-logs << EOF
/var/www/*/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data developers
    sharedscripts
    postrotate
        [ -s /var/run/nginx.pid ] && kill -USR1 \$(cat /var/run/nginx.pid)
    endscript
}
EOF

```

业务场景：在多租户环境中，需要监控各用户的磁盘使用情况，防止单个用户耗尽所有空间。同时需要定期清理日志和临时文件，保持系统高效运行。

### 2. 文件与数据处理

#### 2.1 日志分析与提取

日志分析是排查故障和监控安全的主要手段：

```bash
# 实时查看日志文件的更新
tail -f /var/log/nginx/access.log

# 查看最近100条日志
tail -n 100 /var/log/nginx/error.log

# 查找包含特定错误的日志行
grep "ERROR" /var/log/application.log

# 统计HTTP 500错误的数量
grep "HTTP/1.1\" 500" /var/log/nginx/access.log | wc -l

# 提取特定时间段的日志
sed -n '/2023-10-01 10:00:00/,/2023-10-01 11:00:00/p' /var/log/application.log

# 找出访问量最高的IP地址
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# 分析慢查询日志，找出最慢的请求
grep -E 'processing time: [0-9.]{2,}' /var/log/nginx/access.log | sort -k4 -nr | head -10

# 提取所有404错误的URL
grep "HTTP/1.1\" 404" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr

# 使用awk高级处理，计算每小时的请求数
awk '{split($4, a, ":"); print a[2]":"a[3]}' /var/log/nginx/access.log | sort | uniq -c | sort -k2

# 提取日志中的JSON数据字段
grep -o '{.*}' /var/log/application.log | jq '.error_message'

```

业务场景：网站出现间歇性500错误，需要分析Nginx和应用程序日志，找出错误原因、发生时间和受影响的URL，以及是否有特定客户端IP引起的问题。

#### 2.2 数据处理与转换

处理结构化数据是许多业务场景的需求：

```text
# 提取CSV文件中的特定列
cut -d',' -f1,3 data.csv > extracted.csv

# 合并两个CSV文件（添加新列）
paste -d',' users.csv roles.csv > combined.csv

# 排序CSV文件（按第2列数字排序）
sort -t',' -k2 -n data.csv > sorted.csv

# 删除重复行
sort data.txt | uniq > unique.txt

# 查找两个文件的差异
diff -u file1.txt file2.txt

# 使用sed替换文件中的内容
sed -i 's/old-domain.com/new-domain.com/g' config.php

# 批量重命名文件
rename 's/\.jpeg$/.jpg/' *.jpeg

# 将文本文件转换为CSV（假设空格分隔）
cat data.txt | tr ' ' ',' > data.csv

# 提取并统计CSV中的数据
awk -F',' '{sum+=$3} END {print "Average:", sum/NR}' sales.csv

# 使用xargs批量处理文件
find . -name "*.php" | xargs grep -l "deprecated"

```

业务场景：电子商务平台需要每天处理来自不同渠道的销售数据，需要合并CSV文件、提取关键字段、进行简单计算并将结果转换为报表格式。

#### 2.3 文件操作与备份

安全地管理和备份文件是数据管理的基础：

```bash
# 创建带时间戳的备份文件
cp database.conf database.conf.$(date +%Y%m%d)

# 使用rsync同步文件夹（保留权限）
rsync -av --progress /var/www/ /backup/www/

# 只同步新增和修改的文件
rsync -avz --update /source/ /destination/

# 使用tar创建压缩归档
tar -czvf backup-$(date +%Y%m%d).tar.gz /var/www/

# 查找并压缩超过30天未修改的日志文件
find /var/log -name "*.log" -type f -mtime +30 -exec gzip {} \;

# 创建增量备份（使用rsnapshot或类似工具）
# 配置文件：/etc/rsnapshot.conf
rsnapshot daily

# 从备份恢复特定文件
tar -xzvf backup-20231001.tar.gz var/www/index.php

# 使用scp安全复制文件到远程服务器
scp backup.tar.gz user@remote-server:/backup/

# 使用shred安全删除敏感文件
shred -u -z /tmp/credentials.txt

# 批量修改文件权限
find /var/www -type f -exec chmod 644 {} \;
find /var/www -type d -exec chmod 755 {} \;

```

业务场景：企业需要为核心应用实施备份策略，包括每日完整备份和不同保留期的增量备份。同时需要确保备份文件的权限设置正确，并定期测试恢复流程。

### 3. 系统监控与故障排查

#### 3.1 性能监控与分析

实时监控系统性能有助于保障服务稳定：

```text
# 实时查看系统资源使用情况
top

# 交互式系统监控器（需安装）
htop

# 查看进程树
pstree

# 查看特定进程的详细信息
ps aux | grep nginx

# 按内存使用排序显示进程
ps aux --sort=-%mem | head -10

# 监控系统平均负载
uptime

# 查看内存使用详情
free -h

# 监控I/O活动
iostat -x 1

# 监控网络连接和流量
netstat -tulanp

# 查看所有TCP连接
ss -tan

# 使用iftop监控网络带宽（需安装）
iftop -i eth0

# 检查系统启动时间和负载历史
who -b
last reboot

# 使用vmstat监控系统资源
vmstat 1 10

# 检查CPU信息和负载
lscpu
mpstat -P ALL 1 5

# 使用dstat综合监控（需安装）
dstat -cdngy 1

```

业务场景：电子商务网站在促销活动期间突然变慢，需要快速确定是CPU瓶颈、内存不足、磁盘I/O限制还是网络饱和，并找出消耗资源最多的进程。

#### 3.2 故障诊断与系统恢复

系统出问题时需要快速定位和解决：

```text
# 检查系统日志中的错误
journalctl -p err..emerg

# 查看特定服务最近的错误
journalctl -u nginx --since today -p err

# 检查磁盘错误
fsck -y /dev/sda1  # 注意：在非挂载状态执行

# 检查磁盘坏道
badblocks -v /dev/sda1

# 修复文件系统
e2fsck -f /dev/sda1

# 查找并修复损坏的软件包
dpkg --audit
dpkg --configure -a  # Debian/Ubuntu
rpm -Va  # CentOS/RHEL

# 检查系统服务状态
systemctl list-units --state=failed

# 检查启动问题
dmesg | grep -i error

# 检查CPU过热问题
sensors  # 需安装lm-sensors

# 查找并终止资源占用过高的进程
ps aux | sort -nrk 3,3 | head -5  # CPU高的进程
ps aux | sort -nrk 4,4 | head -5  # 内存高的进程
sudo kill -15 <pid>  # 优雅终止
sudo kill -9 <pid>   # 强制终止

# 检查网络连接问题
netstat -tuln | grep 80  # 检查端口是否在监听
traceroute google.com    # 检查网络路径
ping -c 4 8.8.8.8        # 测试网络连通性

# 查看系统限制
ulimit -a

# 恢复误删除的文件（需安装extundelete或similar）
sudo extundelete /dev/sda1 --restore-file /path/to/deleted_file

```

业务场景：数据库服务器意外重启后无法启动，需要检查系统日志、文件系统状态和磁盘健康状况，然后尝试恢复系统并验证数据完整性。

#### 3.3 安全审计与检查

定期进行安全检查可以预防安全事件：

```text
# 查看当前登录用户
who

# 查看登录历史
last

# 查看失败的登录尝试
lastb

# 检查可疑的身份验证尝试
grep "Failed password" /var/log/auth.log

# 列出系统上所有开放端口
netstat -tulpn | grep LISTEN

# 查找root权限的进程
ps aux | grep root

# 检查修改过的系统文件
debsums -c  # Debian/Ubuntu
rpm -Va  # CentOS/RHEL

# 查找具有SUID权限的文件
find / -type f -perm -4000 -ls 2>/dev/null

# 检查计划任务
crontab -l
ls -la /etc/cron*

# 审计系统用户
cat /etc/passwd | grep -v nologin | grep -v false

# 查找可写的系统文件和目录
find /etc -type f -writable -ls 2>/dev/null
find /etc -type d -writable -ls 2>/dev/null

# 使用ClamAV扫描病毒（需安装）
clamscan -r /var/www

# 检查rootkit（需安装rkhunter）
rkhunter --check

# 检查系统文件完整性（需配置AIDE）
aide --check

```

业务场景：网站服务器流量异常增加，怀疑被入侵，需要检查最近的登录记录、异常进程、修改过的系统文件和可疑的网络连接，以确定是否被黑客攻击。

### 4. 网络配置与诊断

#### 4.1 网络配置与管理

正确配置网络是服务器运维的基本要求：

```bash
# 查看网络接口配置
ip addr show

# 查看路由表
ip route show

# 添加临时IP地址
sudo ip addr add 192.168.1.100/24 dev eth0

# 临时启用/禁用网络接口
sudo ip link set eth0 up
sudo ip link set eth0 down

# 配置永久网络设置（Ubuntu/Debian）
sudo nano /etc/netplan/01-netcfg.yaml

# 应用netplan配置
sudo netplan apply

# 配置DNS服务器
sudo nano /etc/resolv.conf

# 设置静态路由
sudo ip route add 10.0.0.0/24 via 192.168.1.1

# 查看网络统计信息
netstat -s

# 使用NetworkManager管理网络（桌面环境）
nmcli connection show
nmcli device status

# 配置网络绑定（增加带宽/冗余）
cat > /etc/modprobe.d/bonding.conf << EOF
alias bond0 bonding
options bond0 mode=0 miimon=100
EOF

# 配置iptables防火墙规则
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP

# 保存iptables规则
sudo iptables-save > /etc/iptables.rules

```

业务场景：为新部署的应用服务器配置双网卡，一个用于公共访问，另一个用于内部数据库连接，并设置相应的路由和防火墙规则，确保安全性和网络隔离。

#### 4.2 网络诊断与故障排查

当网络出现问题时，以下命令可以帮助诊断和解决：

```text
# 测试与特定主机的连通性
ping -c 4 example.com

# 跟踪网络路径
traceroute google.com

# 使用mtr进行高级网络路径分析
mtr --report google.com

# 检查DNS解析
dig example.com
nslookup example.com

# DNS追踪
dig +trace example.com

# 检查特定端口的连通性
nc -zv google.com 443

# 检查SSL/TLS连接和证书
openssl s_client -connect example.com:443

# 查看侦听端口
ss -tuln

# 查看活动的网络连接
ss -tap

# 查看特定进程的网络连接
ss -tap | grep nginx

# 使用curl测试HTTP服务
curl -I https://example.com

# 捕获网络数据包（需安装tcpdump）
sudo tcpdump -i eth0 host 192.168.1.1

# 捕获特定端口的流量
sudo tcpdump -i eth0 port 80

# 使用过滤器捕获特定类型的流量
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn) != 0'

# 查看网络接口统计
ip -s link show eth0

# 测试网络带宽（使用iperf3，需安装）
# 服务器：
iperf3 -s
# 客户端：
iperf3 -c server_ip

```

业务场景：企业应用无法连接到外部API服务，需要诊断是DNS解析问题、网络路由问题、防火墙阻断还是API服务器本身的问题。

#### 4.3 VPN与安全隧道

远程访问和安全通信是企业网络的重要组成部分：

```bash
# 设置OpenVPN客户端连接
sudo openvpn --config client.ovpn

# 检查VPN接口
ip addr show tun0

# 配置SSH隧道进行端口转发
ssh -L 8080:localhost:80 user@remote-server

# 建立反向SSH隧道（用于远程支持）
ssh -R 8080:localhost:80 user@support-server

# 使用SSH进行SOCKS代理
ssh -D 1080 user@remote-server

# 查看活动的SSH隧道
netstat -tulpn | grep ssh

# 创建持久SSH隧道（需安装autossh）
autossh -M 20000 -L 8080:localhost:80 user@remote-server

# 使用socat创建加密隧道
# 服务器端：
socat OPENSSL-LISTEN:443,cert=server.pem TCP-LISTEN:80,fork
# 客户端：
socat TCP-LISTEN:8080,fork OPENSSL-CONNECT:server:443

# 设置WireGuard VPN（需安装）
wg-quick up wg0

# 检查WireGuard状态
wg show

# IPsec VPN状态检查（使用strongSwan）
sudo ipsec status

```

业务场景：公司员工需要从家中安全地访问内部开发环境，IT部门配置VPN服务器并提供客户端配置文件，同时设置监控和访问控制，以确保只有授权用户能够连接。

### 5. 自动化运维实战

#### 5.1 Shell脚本自动化

使用 shell 脚本自动化日常任务可以提升效率：

```properties
# 简单的备份脚本示例
#!/bin/bash
# backup-script.sh

# 配置
BACKUP_DIR="/backup"
SOURCE_DIR="/var/www"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# 检查备份目录是否存在
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

# 创建备份
echo "开始备份..."
tar -czf "$BACKUP_FILE" "$SOURCE_DIR"

# 验证备份
if [ $? -eq 0 ]; then
    echo "备份成功: $BACKUP_FILE"
    # 清理旧备份（保留最近7个）
    ls -t $BACKUP_DIR/backup-*.tar.gz | tail -n +8 | xargs -r rm
else
    echo "备份失败！"
    exit 1
fi

# 使用脚本：
chmod +x backup-script.sh
./backup-script.sh

# 监控脚本示例
#!/bin/bash
# monitor.sh

# 检查服务是否运行
check_service() {
    systemctl is-active $1 >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "$1 服务未运行，尝试重启..."
        systemctl restart $1

        # 再次检查
        sleep 5
        systemctl is-active $1 >/dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "$1 重启失败，发送警报..."
            # 发送警报（例如通过邮件）
            echo "$1 无法启动" | mail -s "服务故障" [email protected]
        else
            echo "$1 已成功重启"
        fi
    fi
}

# 检查磁盘空间
check_disk_space() {
    usage=$(df -h / | grep / | awk '{ print $5 }' | sed 's/%//')
    if [ $usage -gt 90 ]; then
        echo "磁盘空间不足! 使用率: $usage%"
        # 发送警报
        echo "服务器磁盘空间不足，使用率: $usage%" | mail -s "磁盘空间警告" [email protected]
    fi
}

# 检查关键服务
check_service nginx
check_service mysql
check_service redis-server

# 检查磁盘空间
check_disk_space

# 设为cron任务，每小时运行一次
# 0 * * * * /path/to/monitor.sh >> /var/log/monitor.log 2>&1

```

业务场景：Web托管公司需要为数百个客户网站进行定期备份，并监控服务器健康状况。通过脚本自动化这些任务，可以减少人工干预，提高可靠性。

#### 5.2 定时任务与作业调度

使用cron和其他调度工具自动执行周期性任务：

```bash
# 编辑当前用户的crontab
crontab -e

# 典型的crontab条目：
# 每天凌晨2点执行备份
0 2 * * * /home/user/backup-script.sh >> /var/log/backup.log 2>&1

# 每周日凌晨3点重启应用
0 3 * * 0 systemctl restart application

# 每5分钟检查一次服务状态
*/5 * * * * /home/user/check-service.sh

# 每个工作日的早上9点执行
0 9 * * 1-5 /home/user/workday-script.sh

# 每小时的第30分钟执行
30 * * * * /home/user/hourly-task.sh

# 查看当前用户的cron任务
crontab -l

# 系统级cron配置（需root权限）
# 编辑文件放入相应目录：
/etc/cron.hourly/
/etc/cron.daily/
/etc/cron.weekly/
/etc/cron.monthly/

# 使用anacron处理系统关闭期间错过的任务
cat /etc/anacrontab

# 使用at命令安排一次性任务
echo "backup.sh" | at 2am tomorrow

# 查看计划的at任务
atq

# 使用batch命令在系统负载较低时执行
echo "intensive-script.sh" | batch

```

业务场景：电子商务网站需要在每天不同时段执行不同任务：深夜进行数据库备份，早上生成日报表，上午同步库存，晚上处理未完成订单。使用cron可以自动按时间表执行这些任务。

#### 5.3 监控与报警自动化

自动监控系统状态并在出现问题时发出警报：

```properties
# 使用简单的监控脚本发送邮件报警
#!/bin/bash
# monitor-and-alert.sh

# 检查网站可访问性
http_code=$(curl -s -o /dev/null -w "%{http_code}" https://example.com)
if [ "$http_code" != "200" ]; then
    echo "网站返回错误码: $http_code" | mail -s "网站故障警报" [email protected]
fi

# 检查CPU负载
load=$(uptime | awk '{print $(NF-2)}' | sed 's/,//')
if (( $(echo "$load > 5.0" | bc -l) )); then
    echo "服务器负载过高: $load" | mail -s "高负载警报" [email protected]
fi

# 检查内存使用
mem_free=$(free -m | grep Mem | awk '{print $4}')
if [ $mem_free -lt 1024 ]; then
    echo "可用内存不足: ${mem_free}MB" | mail -s "内存不足警报" [email protected]
fi

# 使用Slack Webhook发送警报
send_slack_alert() {
    curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$1\"}" \
    https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
}

# 检查数据库连接
if ! mysqladmin ping -h localhost -u user -ppassword --silent; then
    send_slack_alert "数据库连接失败，请立即检查！"
fi

# 检查SSL证书过期
domain="example.com"
expire_date=$(openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
expire_epoch=$(date -d "$expire_date" +%s)
now_epoch=$(date +%s)
days_left=$(( (expire_epoch - now_epoch) / 86400 ))

if [ $days_left -lt 14 ]; then
    send_slack_alert "警告: $domain 的SSL证书将在 $days_left 天后过期！"
fi

```

业务场景：企业需要全天候监控多个应用服务的可用性、性能和安全状态。通过自动化脚本定期检查关键指标，并使用不同渠道（邮件、短信、Slack）发送警报，确保团队能够迅速响应问题。

#### 5.4 配置管理与部署自动化

使用现代工具自动化配置管理和应用部署：

```text
# 使用Ansible执行远程命令（需安装Ansible）
ansible webservers -m ping
ansible webservers -a "uptime"

# 使用Ansible Playbook部署应用
ansible-playbook deploy.yml

# 使用Git进行配置管理
cd /etc/nginx
git init
git add .
git commit -m "Initial Nginx configuration"

# 在修改配置前创建分支
git checkout -b feature-ssl-config
# 修改配置...
git add sites-available/example.com
git commit -m "Add SSL configuration for example.com"

# 测试配置并应用
nginx -t
systemctl reload nginx

# 如果测试成功，合并更改
git checkout master
git merge feature-ssl-config

# 创建Docker容器（需安装Docker）
docker run -d --name web -p 80:80 nginx

# 构建自定义Docker镜像
cat > Dockerfile << EOF
FROM php:7.4-fpm
RUN apt-get update && apt-get install -y \
    libpng-dev \
    && docker-php-ext-install pdo pdo_mysql gd
COPY . /var/www/html
EOF

docker build -t myapp:1.0 .
docker run -d --name myapp -p 8080:80 myapp:1.0

# 使用docker-compose管理多容器应用
cat > docker-compose.yml << EOF
version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
  app:
    build: .
    volumes:
      - .:/var/www/html
  db:
    image: mysql:5.7
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: myapp
EOF

docker-compose up -d

```

业务场景：软件开发团队需要部署新版Web应用，包括更新前端代码、迁移数据库结构和重新配置Web服务器。使用配置管理和容器化工具可以创建可重复的部署流程，减少手动操作错误。

以上是 Linux 常用命令在各种实际业务场景中的应用实例。熟练使用这些命令，结合实际需求组合运用，能有效提升日常运维效率。
