# PBX client

This client is
a FreeSWITCH verto endpoint module
JSON-RPC 2.0 WebSocket client.

- Reconnects on WebSocket disconnection with backoff on retry.
- Logs in on WebSocket connection.
- Subscribes to receive
  the channel's presence events
  on client ready.
- Publishes its presence status
  to the event channel.
- Negotiates peer-to-peer media connections
  with other clients 
  via the verto endpoint.


## Perfect negotiation

The PeerConnection class
implements perfect negotiation
as per the spec example at
https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
and modified as per the blog post at
https://blog.mozilla.org/webrtc/perfect-negotiation-in-webrtc/.

In perfect negotiation,
an SDP offer collision occurs
when a peer receives an SDP offer
while it's generating and sending
an offer based on its own local stream,
or when the RTCPeerConnection signaling state
is not `stable`.

When collisions occur,
the impolite peer
ignores the incoming offer
and the polite peer
rolls back the offer it's
currently generating,
accepts the incoming offer,
and generates and sends a new offer.


## Signal channel

The peer-to-peer signal channel
is implemented using the verto endpoint
`verto.info` `msg` function.

Clients base64-encode message bodies before sending
and decode upon receipt
so that the FreeSWITCH chat command
doesn't change them en route.

The `msg` function
generates a `MESSAGE` event
with `proto` field `verto`
and `dest_proto` field `GLOBAL`.

FreeSWITCH is configured
to detect `MESSAGE` events
(via a simple Lua script)
and delivers the messages
to the correct peer
by executing an API command
that sends the `MESSAGE` body
directly to the target verto user.


## Peer connection establishment

To establish a peer connection,
one peer makes a connection offer
and another accepts.

Peers allow
only a single peer connection
at a time.

### Offering peer

To start a new peer connection,
peers create a new PeerConnection object,
initialize the object's local media stream
(by enumerating and getting local media),
and send an `offer` message
directly to another peer.

If the offering peer receives `close` in response,
the offering peer destroys the PeerConnection object.

If the offering peer receives `accept` in response,
the offering peer fully initializes the peer connection
by creating an RTCPeerConnection object,
attaching the peers's handlers to the object's events
and adding local media stream tracks
to the RTCPeerConnection object.

The PeerConnection's
implementation of perfect negotiation
handles ICE and SDP negotiation.
The offering peer
is the polite peer.

Once the offering peer
has created and initialized
a PeerConnection object
it rescinds its offer
and/or closes an existing peer connection
by destroying its PeerConnection object
and sending `close` to the other peer.

Destroying a PeerConnection object
removes the local media stream from the view's srcObject,
closes local media stream tracks,
and closes the RTCPeerConnection.

### Invited peer

When a peer receives an `offer` message,
it can ignore the offer
or send `close`
to refuse the offer.

The peer accepts an offer
by creating a PeerConnection object,
initializing the object's local media,
sending `accept` to the offering peer
once local media is ready,
and immediately initializing the peer connection.

The PeerConnection's
implementation of perfect negotiation
handles ICE and SDP negotiation.
The invited peer
is the impolite peer.

Once the invited peer
has accepted an offer
and initialized the PeerConnection,
it closes the connection
at any time
by destroying the PeerConnection object
and sending `close` to the offering peer.
