# Add client name feature

Allow the view to set
a user-configurable client name
instead of showing truncated session ID
in the view status message label.

If there's no client name in localStorage
for a particular channel
when the client logs in to the channel,
show a client-name entry dialog when a client
pre-populated with the truncated session ID.

If a client name is already in localStorage
when the client logs in to the channel,
show the client-name dialog
pre-populated with the existing value.

Validate client name somehow
in the entry dialog.

The cient-name dialog's
pre-populated value is highlighted,
the input item is selected,
and there's an enter key listener
on the input item
so it's easy for the user
to type in a new name from scratch
or just hit enter
to accept the existing value.

Pop up the client-name entry dialog
when the client name/ID label is clicked.

Store client name by channel
in browser local storage
so a client can have a different name
for each channel it can access,
and so the client name persists session IDs.

Send client names
in channel presence messages.

Show client names
in the peers dialog.

Clients must somehow validate
received client names.
