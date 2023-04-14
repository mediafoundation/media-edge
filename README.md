<div style="align:center">
  <a href="https://github.com/mediafoundation/media-edge-deploy">
    <img src="images/media-edge.png" alt="Logo" width="100%" height="100%">
  </a>

  <p style="align:center">
    <a href="https://docs.media.network"><strong>Explore the docs »</strong></a>
    <br />
    <a href="https://app.media.network">Use the dCDN</a>
    ·
    <a href="https://github.com/mediafoundation/media-edge-deploy/issues">Report Bug</a>
    ·
    <a href="https://github.com/mediafoundation/media-edge-deploy/issues">Request Feature</a>
  </p>
</div>


<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
      <br />
  <ol>
    <li>
      <a href="#about-media-edge">About Media Edge</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage & Troubleshooting</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT MEDIA EDGE -->
## About Media Edge
  
Media Edge is a new and powerful software that allows CDN providers to create their content delivery network and sell their services in the decentralized Media Network marketplace. With the Media Edge, providers can easily set up their CDN networks, offer them within the Media Network marketplace, and get MEDIA rewards in exchange for the services provided.

## What is Media Edge?

Media Edge is an open-source software that serves as a web server and blockchain resource manager for CDN providers. It is a tool that simplifies the process of setting up a CDN network, and it includes all the necessary features to interact with the Media Network smart contracts from the provider stand point.

### Built With:

* [Ansible](https://www.ansible.com/)
* [Caddy](https://caddyserver.com/)
* [Varnish](https://varnish-cache.org/)
* [NodeJs](https://nodejs.org/)
* [Kibana](https://www.elastic.co/kibana/)
* [Elasticsearch](https://www.elastic.co/elasticsearch/)
* [Logstash](https://www.elastic.co/logstash/)
* [Filebeat](https://www.elastic.co/beats/filebeat)
* [hsd](https://github.com/handshake-org/hsd)

## Getting Started

Follow these simple example steps to get your Media Edge setup and running in no time.

### Software Prerequisites

* [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html#installing-ansible-on-specific-operating-systems)
* [Debian 10 x64](https://www.debian.org/releases/buster/debian-installer/)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/mediafoundation/media-edge-deploy.git
   ```

2. Navigate to `media-edge-deploy` folder
   ```sh
   cd media-edge-deploy
   ```

4. Copy `media-edge-deploy/hosts/edges.example` to `media-edge-deploy/hosts/edges` and edit the file: replace `xxx.xxx.xxx.xxx` with your server's IP address. You can add multiple servers (one per line).
    ```sh
    [edges]
    127.0.0.1 ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_user=root ansible_port=22
    ```

5. Edit `media-edge-deploy/user_config.yml` file with your MEDIA wallet address and network (SOL, ETH, POLYGON, BSC, AVAX, RSK). This is required to verify that your wallet owns the server. Also you can tune up your system resources here.
    ```sh
      wallet_address: xxxxxxxxxxxxxxxxxxxxxxxxxx
      wallet_network: SOL
      ...
    ```

6. Deploy Media Edge
    ```sh
    ansible-playbook deploy.yml -i hosts/edges
    ```

7. Make sure your Media Edge is running:
    ```sh
    root@hostname:~# curl http://localhost:422/config
    WalletAddress = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
    WalletNetwork = "SOL"
    ```

<!-- USAGE EXAMPLES -->
## Usage & Troubleshooting

For more information, please refer to the [Media Edge Docs](https://docs.media.network/media-edge-about).

<!-- ROADMAP -->
## Roadmap

- [X] First Release
- [ ] TBD
- [ ] TBD
- [ ] TBD

See the [open issues](https://github.com/mediafoundation/media-edge-deploy/issues) for a full list of proposed features (and known issues).

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
