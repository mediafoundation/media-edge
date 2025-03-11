# Vagrant Instructions

The following instructions will guide you through the process of installing Vagrant and VirtualBox, and how to use the provided Vagrantfile to deploy the VMs. After the deployment, you can use the provided Ansible playbooks to configure the VMs. 

We also provide instructions on how to build a working vagrant image after successful deployment, so your subsequent deployments will be faster.

## Prerequisites

- [Vagrant](https://www.vagrantup.com/downloads)
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

## Installation

There are several ways to install Vagrant, but the easiest way is to using APT package manager. If you are using a different package manager, or another OS, please refer to the [official documentation](https://www.vagrantup.com/docs/installation).

### Using APT package manager

```bash
sudo apt update && sudo apt install vagrant virtualbox
```

## How to deploy the VMs

After installing Vagrant and VirtualBox, it's time to deploy the VMs. We provide a `Vagrantfile.example` that you can use to deploy the VMs.

```bash
# Copy the Vagrantfile.example to Vagrantfile
cp Vagrantfile.example Vagrantfile
# Start the VMs
vagrant up
```

For testing purposes, the vagrant boxes are provisioned with the default Vagrant's insecure private key for both `root` and `vagrant` users. The private key is located at `ansible/insecure_private_key`.

## How to deploy the VMs with Ansible

After deploying the VMs, you can use the provided Ansible playbooks to configure the VMs. 

```bash
# Copy the user_config.example.yml to user_config.yml
cp user_config.example.yml user_config.yml

# Edit the user_config.yml file with your desired configuration
nano user_config.yml

# Run the Ansible playbook (hosts.example file is compatible with Vagrantfile.example out of the box)
ansible-playbook deploy.yml -i hosts.example
```

## How to login to the vagrant boxes

```bash
# Login to default origin IP
ssh -i ~/.vagrant.d/insecure_private_key root@192.168.0.170 

# Login to default edge IP
ssh -i ~/.vagrant.d/insecure_private_key root@192.168.0.171
```

## How to build a working vagrant image after successful deployment


In order to mantain the size of the vagrant boxes as small as possible, it is recommended to clean up the system before packaging the VMs.


SSH to the vagrant box and run the following commands as root:

```bash
cd ~/containers && \
docker compose down && \
rm -rf caddyLogs/* && \
rm -rf /etc/ssl/caddy/* && \
rm -rf /root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/* && \
apt --purge autoremove && apt autoclean && \
history -c
```
### Find more big files

You can use the following command to find the largest files on the system, and then decide which ones to delete.

```bash
du -ah / | sort -rh | head -n 20
```

### TODO: Check which of those are safe to run to save space on VMS

```bash
docker image prune --all -f 
docker buildx prune --all -f 
docker builder prune --all -f
```

## On the host machine

After the cleanup, it's now time to package the vagrant boxes. 

The following command will list all the VMs, so we can find the correct name to use in the `vagrant package` command.

```bash
VBoxManage list vms
```

### Exporting the VMs

Now that we have the correct VM name, we can export the VMs to `.box` files.

```bash
# Replace <id> with the correct VM id
vagrant package --base "ansible_origin_<id>" --output origin.box && \
vagrant package --base "ansible_edge_<id>" --output edge.box
```

