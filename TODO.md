Add a reason string to close messages
so peers that fail ICE
can inform the other peer of the failure.

Improve the view's showAlert dialog
so it's not blocking.

Use a client-generated session ID
instead of client ID
for client login.

Allow peers to set a peer name
instead of showing only peer ID.
Show a peer-name entry dialog when a peer
joins the channel.
Pop up the peer-name entry dialog
when the peer ID label is clicked.
Store the per-channel peer name
in browser local storage.
Send peer names
in presence messages.

Implement presence update
and timeout checks.
Absent peers
sometimes appear in the peers list
when browsers don't call Peer.disconnect()
when leaving the page.

Avoid client message storms.
Add randomness
to reconnection and ping period

Limit the number of clients per channel.
Is it possible to set this limit
in the app model,
but enforce it in FreeSWITCH?
