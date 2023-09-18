# Media Edge

![Logo](media-edge.png)

**Media Edge** is your one-stop solution for creating and monetizing Content Delivery Networks in the decentralized Media Network marketplace.

[![Version Badge](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/mediafoundation/media-edge/releases)

[**Explore the docs »**](https://docs.media.network)  
[Use the Markeplace](https://app.media.network)  
[Report Bug](https://github.com/mediafoundation/media-edge/issues)  
[Request Feature](https://github.com/mediafoundation/media-edge/issues)

- [Table of Contents](#table-of-contents)
  * [About Media Edge](#about-media-edge)
    + [Built With](#built-with)
  * [Getting Started](#getting-started)
    + [Software Prerequisites](#software-prerequisites)
    + [Installation](#installation)
  * [Usage & Troubleshooting](#usage--troubleshooting)
  * [Roadmap](#roadmap)
  * [Contributing](#contributing)
  * [License](#license)
  * [Contact](#contact)

## About Media Edge

Media Edge is a software that allows CDN providers to create their content delivery network and sell their services in the decentralized Media Network marketplace. With the Media Edge, providers can easily set up their CDN networks, offer them within the Media Network marketplace, and get MEDIA rewards in exchange for the services provided.

## What is Media Edge?

Media Edge allows CDN providers to create their content delivery network, sell their services in the decentralized Media Network marketplace, and earn MEDIA rewards in exchange for the services provided. It serves as a web server and blockchain resource manager, simplifying the CDN setup process and enabling interaction with the Media smart contracts.


### Built With:

* [Ansible](https://www.ansible.com/)
* [Caddy](https://caddyserver.com/)
* [Elasticsearch](https://www.elastic.co/elasticsearch/)
* [Ethers](https://ethers.org/)
* [Express](https://expressjs.com/)
* [Filebeat](https://www.elastic.co/beats/filebeat)
* [hsd](https://github.com/handshake-org/hsd)
* [Kibana](https://www.elastic.co/kibana/)
* [Logstash](https://www.elastic.co/logstash/)
* [NodeJs](https://nodejs.org/)
* [PostgreSQL](https://www.postgresql.org/)
* [TweetNaCl.js](https://tweetnacl.js.org/)
* [Vagrant](https://www.vagrantup.com/)
* [Varnish](https://varnish-cache.org/)
* [web3.js](https://web3js.org/#/)

## Getting Started

Follow these simple example steps to get your Media Edge setup and running in no time.

### Software Prerequisites

* [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html#installing-ansible-on-specific-operating-systems) @ local computer
* [Debian 10 x64](https://www.debian.org/releases/buster/debian-installer/) @ target server(s)

### Installation
In the following example we will be using vagrant and virtualbox to create a test enviroment.

1. Clone the repo and submodule (abis)
  ```
  sh
  git clone https://github.com/mediafoundation/media-edge.git
  git submodule init
  git submodule update
  ```

2. Navigate to `ansible` folder
   ```sh
   cd ansible
   ```

3. Copy `hosts.example` to `hosts` and edit the file: replace with your servers IP addresses. You can add multiple origin and edge servers.
    ```sh
    [origin]
    origin ansible_host=192.168.0.170 ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_user=root ansible_port=22
    [edge]
    edge ansible_host=192.168.0.171 ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_user=root ansible_port=22
    edge ansible_host=192.168.0.172 ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_user=root ansible_port=22
    ```

4. Copy `user_config.yml.example` to `user_config.yml` and edit with up your wallet and other settings, like provider domains or RPC endpoints.

5. Deploy Media Edges
    ```sh
    ansible-playbook deploy.yml -i hosts
    ```


## Testing with Vagrant

Vagrant config files to deploy testing instances are included. To install dependencies use:

```sh
apt install vagrant virtualbox
```
Then in the `ansible` folder, you should run 

```sh
vagrant up --provider virtualbox
```

### Using dnsmasq keeping systemd-resolved

Add the following lines to `/etc/dnsmasq.conf`

```sh
listen-address=127.0.55.1
bind-interfaces
address=/medianetwork.test/192.168.0.171
```
And then restart with ``systemctl restart dnsmasq``

Then, let systemd-resolved to listen to dnsmasq for any queries. This can be done safely by creating a file under /etc/systemd/resolved.conf.d/dnsmasq.conf like the following...

```sh
[Resolve]
DNS=127.0.55.1
```

And lastly restart using ``systemctl restart systemd-resolved``

## Usage & Troubleshooting

If you encounter issues while setting up or using Media Edge, this section provides solutions to some common problems.

### GlusterFS Authentication Issue

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

<!-- ROADMAP -->
## Roadmap

- [X] First Release
- [ ] TBD
- [ ] TBD
- [ ] TBD

See the [open issues](https://github.com/mediafoundation/media-edge/issues) for a full list of proposed features (and known issues).

<!-- CONTRIBUTING -->
## Contributing

Contributions make the open-source community a fantastic place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion to improve this, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement."
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<!-- CONTACT -->
## Contact

Media Foundation - [@Media_FDN](https://twitter.com/Media_FDN) - hello@media.foundation
