# 🌐 Media Edge

![Logo](media-edge.png)

**Media Edge** is your one-stop solution for creating and monetizing Content Delivery Networks in the decentralized Media Network marketplace. 🚀

[![Version Badge](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/mediafoundation/media-edge/releases)

- [📖 Explore the docs »](https://docs.media.network)
- [🛍️ Use the Marketplace](https://app.media.network)
- [🐞 Report Bug](https://github.com/mediafoundation/media-edge/issues)
- [💡 Request Feature](https://github.com/mediafoundation/media-edge/issues)

## 📌 Table of Contents
- [About Media Edge](#about-media-edge)
- [Built With 💼](#built-with)
- [Getting Started 🚀](#getting-started)
  - [Software Prerequisites 📋](#software-prerequisites)
  - [Installation 🛠️](#installation)
- [Testing with Vagrant 📦](#testing-with-vagrant)
  - [Using dnsmasq with systemd-resolved 🔄](#using-dnsmasq-with-systemd-resolved)
- [Usage & Troubleshooting 🛠️](#usage--troubleshooting)
  - [GlusterFS Authentication Issue 🚫](#glusterfs-authentication-issue)
- [Roadmap 🗺️](#roadmap)
- [Contributing 🤝](#contributing)
- [License 📜](#license)
- [Contact 📞](#contact)

## 📢 About Media Edge

Media Edge is a software that allows CDN providers to create their content delivery network and sell their services in the decentralized Media Network marketplace. With Media Edge, providers can easily set up their CDN networks, offer them within the Media Network marketplace, and get MEDIA rewards in exchange for the services provided.

## Built With 💼
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

Follow these simple example steps to get your Media Edge setup and running in no time.

### 📋 Software Prerequisites
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html#installing-ansible-on-specific-operating-systems) @ local computer
- [Debian 10 x64](https://www.debian.org/releases/buster/debian-installer/) @ target server(s)

### 🛠️ Installation

1. Clone the repo and submodule (abis)
   ```sh
   git clone https://github.com/mediafoundation/media-edge.git
   cd media-edge
   git submodule init
   git submodule update
   ```

2. Navigate to `ansible` folder
   ```sh
   cd ansible
   ```

3. Copy `hosts.example` to `hosts` and edit the file: replace with your servers IP addresses.
   ```sh
   cp hosts.example hosts
   ```

4. Copy `user_config.yml.example` to `user_config.yml` and edit with up your wallet and other settings.
   ```sh
   cp user_config.yml.example user_config.yml
   ```

5. Deploy Media Edges
   ```sh
   ansible-playbook deploy.yml -i hosts
   ```

## 📦 Testing with Vagrant

Vagrant config files are included to help you deploy testing instances. This allows you to create virtual machines and test Media Edge in a controlled environment. To install the necessary dependencies, use:

```sh
apt install vagrant virtualbox
```

Then, within the `ansible` folder, initiate the virtual machines:

```sh
vagrant up --provider virtualbox
```

### 🔄 Using dnsmasq with systemd-resolved

When testing with Vagrant, you might want to use `dnsmasq` alongside `systemd-resolved` for DNS configurations. Here's how:

1. Add the following lines to `/etc/dnsmasq.conf`:

```sh
listen-address=127.0.55.1
bind-interfaces
address=/medianetwork.test/192.168.0.171
```

2. Restart dnsmasq:

```sh
systemctl restart dnsmasq
```

3. Let `systemd-resolved` listen to `dnsmasq` for any queries. Safely create a file under `/etc/systemd/resolved.conf.d/dnsmasq.conf` with the following content:

```sh
[Resolve]
DNS=127.0.55.1
```

4. Lastly, restart `systemd-resolved`:

```sh
systemctl restart systemd-resolved
```

## 🛠️ Usage & Troubleshooting

### 🚫 GlusterFS Authentication Issue

If you encounter an error related to GlusterFS authentication when trying to mount the GlusterFS volume, follow these steps:

1. **Check auth.allow**: Ensure that the `auth.allow` option for the GlusterFS volume includes the IP address of the client. You can check this with:
   ```bash
   gluster volume get cert_vol auth.allow
   ```
   If the IP address of the client is not listed, you need to add it.

2. **Set auth.allow**: To add the IP address of the client to the `auth.allow` list, use:
   ```bash
   gluster volume set cert_vol auth.allow <existing IPs>,<client IP>
   ```
   Replace `<existing IPs>` with the current list of IPs (if any) and `<client IP>` with the IP address of the client.

3. **Firewall**: Ensure that there are no firewall rules blocking the necessary ports for GlusterFS communication. This includes port `24007` for GlusterD and other ports for brick communication.

4. **Restart GlusterD**: After making changes, restart the GlusterD service:
   ```bash
   systemctl restart glusterd
   ```

5. **Re-run Ansible Playbook**: After addressing the GlusterFS authentication issue, re-run the Ansible script to ensure Media Edge is correctly installed and configured:
   ```bash
   ansible-playbook deploy.yml -i hosts
   ```

For more detailed troubleshooting, always refer to the GlusterFS logs, typically located in `/var/log/glusterfs/`.

For more information, please refer to the [Media Edge Docs](https://docs.media.network/cdn-marketplace-edge).

## 🗺️ Roadmap

- [X] First Release
- [ ] TBD
- [ ] TBD
- [ ] TBD

See the [open issues](https://github.com/mediafoundation/media-edge/issues) for a full list of proposed features (and known issues).

## 🤝 Contributing

Contributions make the open-source community a fantastic place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion to improve this, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement."
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## 📞 Contact

Media Foundation - [@Media_FDN](https://twitter.com/Media_FDN) - hello@media.foundation
