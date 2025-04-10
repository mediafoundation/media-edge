# 🌐 Media Edge

![Logo](media-edge.png)

**Media Edge** is the ultimate software for creating and monetizing Content Delivery Networks in the decentralized Media Network marketplace. 🚀

[![Version Badge](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/mediafoundation/media-edge/releases)

- [📖 Explore the Documentation](https://docs.media.network)
- [🛍️ Visit the Marketplace](https://app.media.network)
- [🐞 Report a Bug](https://github.com/mediafoundation/media-edge/issues)
- [💡 Request a Feature](https://github.com/mediafoundation/media-edge/issues)

## 📢 About Media Edge

Media Edge is a state-of-the-art software solution designed for CDN providers to effectively monetize their hardware resources. It enables providers to easily set up and manage their content delivery networks, facilitating the selling of these services on the decentralized Media Network marketplace. Providers can efficiently integrate their offerings into the marketplace, earning MEDIA tokens as compensation for their CDN services. 

## Built With 💼

Media Edge integrates a wide range of technologies:

- [Ansible](https://www.ansible.com/)
- [Caddy](https://caddyserver.com/)
- [Elasticsearch](https://www.elastic.co/elasticsearch/)
- [Ethers](https://ethers.org/)
- [Express](https://expressjs.com/)
- [Filebeat](https://www.elastic.co/beats/filebeat)
- [hsd](https://github.com/handshake-org/hsd)
- [Kibana](https://www.elastic.co/kibana/)
- [Logstash](https://www.elastic.co/logstash/)
- [NodeJs](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [TweetNaCl.js](https://tweetnacl.js.org/)
- [Vagrant](https://www.vagrantup.com/)
- [Varnish](https://varnish-cache.org/)
- [web3.js](https://web3js.org/#/)
... and many more!

## 🚀 Getting Started

Get your Media Edge setup up and running in no time with these straightforward steps.

### 📋 Software Prerequisites

Ensure these are installed on your local computer and target server(s):

- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html#installing-ansible-on-specific-operating-systems)
- [rsync](https://rsync.samba.org/)
- [Debian 11 x64](https://www.debian.org/releases/bullseye/)

### 🛠️ Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/mediafoundation/media-edge.git
   cd media-edge
   ```
2. Navigate to the `ansible` folder:
   ```sh
   cd ansible
   ```
3. Prepare the hosts file:
   ```sh
   cp hosts.example hosts
   # Edit hosts with your server's IP addresses
   ```
4. Set up your configuration:
   ```sh
   cp user_config.yml.example user_config.yml
   # Edit user_config.yml with your wallet and other settings
   ```
5. Deploy Media Edge:
   ```sh
   ansible-playbook deploy.yml -i hosts
   ```

## 📦 Testing with Vagrant

Vagrant is used for deploying test instances in a controlled environment. Install the dependencies and initiate virtual machines in the `ansible` folder:

```sh
apt install vagrant virtualbox
vagrant up --provider virtualbox
```

### 🔄 Using dnsmasq with systemd-resolved

For DNS configurations during Vagrant testing, follow these steps:

1. Configure `/etc/dnsmasq.conf`:
   ```sh
   # Add the following lines to the file
   listen-address=127.0.55.1
   bind-interfaces
   ```
2. Restart dnsmasq:
   ```sh
   systemctl restart dnsmasq
   ```
3. Configure `systemd-resolved`:
   ```sh
   # Create /etc/systemd/resolved.conf.d/dnsmasq.conf with the content:
   [Resolve]
   DNS=127.0.55.1
   ```
4. Restart `systemd-resolved`:
   ```sh
   systemctl restart systemd-resolved
   ```

## 🛠️ Usage & Troubleshooting

Refer to the [Media Network Documentation](https://docs.media.network/) for detailed guidance. Check [open issues](https://github.com/mediafoundation/media-edge/issues) for ongoing features and known issues.

## 🤝 Contributing

Your contributions are highly valued. To contribute:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License. See `LICENSE.txt` for more details.

## 📞 Contact

 [Twitter/X](https://twitter.com/Media_FDN)
 [Discord](https://discord.com/invite/wwSw3J7F2j)

