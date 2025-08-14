#!/bin/bash

# Pay Lightning invoice in regtest
# Usage: ./pay-invoice.sh <invoice>

if [ -z "$1" ]; then
    echo "Usage: $0 <invoice>"
    exit 1
fi

INVOICE=$1

# Container names from cashu-regtest
LND1_CONTAINER="cashu-regtest-lnd-1-1"
LND2_CONTAINER="cashu-regtest-lnd-2-1"
BITCOIN_CONTAINER="cashu-regtest-bitcoind-1"

echo "Checking LND-1 wallet balance..."
BALANCE=$(docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 walletbalance 2>/dev/null | grep confirmed_balance | grep -o '[0-9]*' | head -1)

if [ -z "$BALANCE" ] || [ "$BALANCE" = "0" ]; then
    echo "LND-1 has no balance. Funding wallet..."
    
    # Get new address
    ADDR=$(docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 newaddress p2wkh | grep address | cut -d'"' -f4)
    echo "Address: $ADDR"
    
    # Send 1 BTC
    docker exec $BITCOIN_CONTAINER bitcoin-cli -regtest -rpcuser=cashu -rpcpassword=cashu sendtoaddress $ADDR 1
    
    # Mine blocks to confirm
    docker exec $BITCOIN_CONTAINER bitcoin-cli -regtest -rpcuser=cashu -rpcpassword=cashu -generate 6
    
    echo "Funded with 1 BTC"
    sleep 2
fi

# Check if we have channels
echo "Checking channels..."
CHANNELS=$(docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 listchannels 2>/dev/null | grep active | wc -l)

if [ "$CHANNELS" = "0" ]; then
    echo "No channels found. Opening channel to lnd-2..."
    
    # Get lnd-2 pubkey
    LND2_PUBKEY=$(docker exec $LND2_CONTAINER lncli --network=regtest --rpcserver=lnd-2:10009 getinfo | grep identity_pubkey | cut -d'"' -f4)
    echo "LND-2 pubkey: $LND2_PUBKEY"
    
    # Connect and open channel
    docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 connect ${LND2_PUBKEY}@lnd-2:9735
    docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 openchannel --node_key=$LND2_PUBKEY --local_amt=500000
    
    # Mine blocks to confirm channel
    ADDR=$(docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 newaddress p2wkh | grep address | cut -d'"' -f4)
    docker exec $BITCOIN_CONTAINER bitcoin-cli -regtest -rpcuser=cashu -rpcpassword=cashu -generate 6
    
    echo "Channel opened and confirmed"
    sleep 3
fi

# Pay the invoice
echo "Paying invoice..."
OUTPUT=$(docker exec $LND1_CONTAINER lncli --network=regtest --rpcserver=lnd-1:10009 payinvoice --force "$INVOICE" 2>&1)

if echo "$OUTPUT" | grep -q "SUCCEEDED"; then
    echo "Payment SUCCEEDED"
    exit 0
else
    echo "Payment failed. Output:"
    echo "$OUTPUT" | tail -15
    exit 1
fi