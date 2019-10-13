#!/bin/bash

# This is the address of the router
FRITZIP=http://fritz.box

# This is the WAN interface
IFACE="2-0"
SIDFILE="/tmp/fritz.sid"

# check config
if [ -z "$FRITZ_PWD" ] || [ -z "$FRITZ_USER" ]  ; then
  echo "Username/Password empty. Specify env FRITZ_USER and FRITZ_PWD" 1>&2 ; exit 1;
fi

if [ ! -f $SIDFILE ]; then
  touch $SIDFILE
fi

function startCapture {
  echo "Trying to login into $FRITZIP as user $FRITZ_USER" 1>&2

  # Request challenge token from Fritz!Box
  CHALLENGE=$(curl -k -s $FRITZIP/login_sid.lua |  grep -o "<Challenge>[a-z0-9]\{8\}" | cut -d'>' -f 2)

  # Very proprieatry way of AVM: Create a authentication token by hashing challenge token with password
  HASH=$(perl -MPOSIX -e '
      use Digest::MD5 "md5_hex";
      my $ch_Pw = "$ARGV[0]-$ARGV[1]";
      $ch_Pw =~ s/(.)/$1 . chr(0)/eg;
      my $md5 = lc(md5_hex($ch_Pw));
      print $md5;
    ' -- "$CHALLENGE" "$FRITZ_PWD")

  curl -k -s "$FRITZIP/login_sid.lua" -d "response=$CHALLENGE-$HASH" -d 'username='${FRITZ_USER} | grep -o "<SID>[a-z0-9]\{16\}" | cut -d'>' -f 2 > $SIDFILE

  SID=$(cat $SIDFILE)

  # Check for successfull authentification
  if [[ $SID =~ ^0+$ ]] ; then echo "Login failed. Did you create & use explicit Fritz!Box users?" 1>&2 ; exit 1 ; fi

  echo "Capturing traffic on Fritz!Box interface $IFACE ..." 1>&2

  wget --no-check-certificate -qO- $FRITZIP/cgi-bin/capture_notimeout?ifaceorminor=$IFACE\&snaplen=\&capture=Start\&sid=$SID | tshark -T fields -e frame.len -e frame.protocols -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -e udp.srcport -e udp.dstport -r -

  # wget --no-check-certificate -qO- $FRITZIP/cgi-bin/capture_notimeout?ifaceorminor=$IFACE\&snaplen=1600\&capture=Start\&sid=$SID | tshark -T json -r -

  echo "Ended unexpected. Good by!" 1>&2
}

function stopCapture {
  SID=$(cat $SIDFILE)
  echo "About to stop capturing." 1>&2
  wget --no-check-certificate -qO- $FRITZIP/cgi-bin/capture_notimeout?ifaceorminor=$IFACE\&snaplen=\&capture=Stop\&sid=$SID 1>&2
  echo "Capturing stopped!" 1>&2
  exit 0
}

export -f startCapture
export -f stopCapture

