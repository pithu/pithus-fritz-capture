#! /bin/sh
sudo rm -f \
    /usr/local/bin/capinfos \
    /usr/local/bin/dftest \
    /usr/local/bin/dumpcap \
    /usr/local/bin/editcap \
    /usr/local/bin/mergecap \
    /usr/local/bin/randpkt \
    /usr/local/bin/rawshark \
    /usr/local/bin/text2pcap \
    /usr/local/bin/tshark \
    /usr/local/bin/wireshark
sudo rm -f /etc/paths.d/Wireshark
sudo rm -f /etc/manpaths.d/Wireshark
sudo pkgutil --forget org.wireshark.cli.pkg
sudo rm -rf /Library/StartupItems/ChmodBPF
sudo rm -rf "/Library/Application Support/Wireshark"
sudo launchctl unload /Library/LaunchDaemons/org.wireshark.ChmodBPF.plist
sudo rm -f /Library/LaunchDaemons/org.wireshark.ChmodBPF.plist
sudo pkgutil --forget org.wireshark.ChmodBPF.pkg
sudo rm -rf /Applications/Wireshark.app
sudo pkgutil --forget org.wireshark.Wireshark.pkg
