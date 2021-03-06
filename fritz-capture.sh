#!/bin/bash

# check params
if [ -z "$FRITZ_PWD" ] || [ -z "$FRITZ_USER" ]  ; then
  echo "Username and/ or Password not set. Specify env FRITZ_USER and FRITZ_PWD" 1>&2 ; exit 1;
fi

if [ -z "$FRITZ_URI" ] || [ -z "$FRITZ_IFACE" ]  ; then
  echo "Frity!Box uri and/ or capture interface not set. Specify env FRITZ_URI and FRITZ_IFACE" 1>&2 ; exit 1;
fi

SIDFILE="/tmp/fritz.sid"
if [ ! -f $SIDFILE ]; then
  touch $SIDFILE
fi

function getSID {
    echo "$(date): Trying to login into $FRITZ_URI as user $FRITZ_USER" 1>&2

  # Request challenge token from Fritz!Box
  CHALLENGE=$(curl -k -s $FRITZ_URI/login_sid.lua |  grep -o "<Challenge>[a-z0-9]\{8\}" | cut -d'>' -f 2)

  # Very proprieatry way of AVM: Create a authentication token by hashing challenge token with password
  HASH=$(perl -MPOSIX -e '
      use Digest::MD5 "md5_hex";
      my $ch_Pw = "$ARGV[0]-$ARGV[1]";
      $ch_Pw =~ s/(.)/$1 . chr(0)/eg;
      my $md5 = lc(md5_hex($ch_Pw));
      print $md5;
    ' -- "$CHALLENGE" "$FRITZ_PWD")

  curl -k -s "$FRITZ_URI/login_sid.lua" -d "response=$CHALLENGE-$HASH" -d 'username='${FRITZ_USER} | grep -o "<SID>[a-z0-9]\{16\}" | cut -d'>' -f 2 > $SIDFILE

  SID=$(cat $SIDFILE)

  # Check for successfull authentification
  if [ -z "${SID}" ] || [[ $SID =~ ^0+$ ]] ; then echo "Login failed. Did you create & use explicit Fritz!Box users?" 1>&2 ; exit 1 ; fi
}

function startCapture {
  echo "$(date): About to start capturing." 1>&2

  getSID

  echo "$(date): Capturing traffic on Fritz!Box interface $FRITZ_IFACE ..." 1>&2

  wget --no-check-certificate -qO- $FRITZ_URI/cgi-bin/capture_notimeout?ifaceorminor=$FRITZ_IFACE\&snaplen=\&capture=Start\&sid=$SID | tshark -T fields -e frame.len -e frame.protocols -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -e udp.srcport -e udp.dstport -r -

  # wget --no-check-certificate -qO- $FRITZ_URI/cgi-bin/capture_notimeout?ifaceorminor=$FRITZ_IFACE\&snaplen=1600\&capture=Start\&sid=$SID | tshark -T json -r -

  echo  "$(date): Ended unexpected. Good by! " 1>&2
}

function stopCapture {
  echo "$(date): About to stop capturing, if its still running." 1>&2

  getSID

  wget --no-check-certificate -qO- $FRITZ_URI/cgi-bin/capture_notimeout?ifaceorminor=$FRITZ_IFACE\&snaplen=\&capture=Stop\&sid=$SID 1>&2
  echo "$(date): Capturing stopped! " 1>&2
}

export -f startCapture
export -f stopCapture
export -f getSID

