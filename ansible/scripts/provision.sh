#! /bin/bash

sudo su;
# This will copy the vagrant's insecure public key to root's authorized_keys
cp /home/vagrant/.ssh/authorized_keys /root/.ssh/authorized_keys;