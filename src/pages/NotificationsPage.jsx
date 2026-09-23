import React from "react";
import { Box, Typography, List, ListItem, ListItemText } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { AuthContext } from "../context/AuthContext";
import './NotificationsPage.css';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = React.useContext(AuthContext) || {};
  const [globalNotes, setGlobalNotes] = React.useState([]);
  const [userNotes, setUserNotes] = React.useState([]);

  React.useEffect(() => {
    const globalRef = collection(db, 'notifications');
    const q = query(globalRef, where('audience', '==', 'all'), where('status', '==', 'active'));
    const unsubGlobal = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, title: d.data()?.title, body: d.data()?.body, createdAt: d.data()?.createdAt, source: 'global' }))
        .filter(x => x && (x.title || x.body));
      setGlobalNotes(rows);
    });

    let unsubUser = null;
    (async () => {
      if (!user) { setUserNotes([]); return; }
      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const userRef = collection(db, 'users', userDocId, 'notifications');
        unsubUser = onSnapshot(userRef, (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, title: d.data()?.title, body: d.data()?.body, createdAt: d.data()?.createdAt, source: 'user', read: d.data()?.read || false, docRef: d.ref }))
            .filter(x => x && (x.title || x.body));
          setUserNotes(rows);
        });
      } catch (_) {
        const fallbackRef = collection(db, 'users', user.uid, 'notifications');
        unsubUser = onSnapshot(fallbackRef, (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, title: d.data()?.title, body: d.data()?.body, createdAt: d.data()?.createdAt, source: 'user', read: d.data()?.read || false, docRef: d.ref }))
            .filter(x => x && (x.title || x.body));
          setUserNotes(rows);
        });
      }
    })();

    return () => {
      if (unsubGlobal) unsubGlobal();
      if (unsubUser) unsubUser();
    };
  }, [user]);

  const merged = React.useMemo(() => {
    const list = [...globalNotes, ...(user ? userNotes : [])];
    return list.sort((a, b) => {
      const da = new Date(a?.createdAt || 0).getTime();
      const dbt = new Date(b?.createdAt || 0).getTime();
      return dbt - da;
    });
  }, [globalNotes, userNotes, user]);
  return (
    <Box className="notifications-root" sx={{ p: 0 }}>
      <List sx={{ pt: 0 }}>
        {merged.map((note) => {
          const created = note?.createdAt ? new Date(note.createdAt) : null;
          const timeStr = created ? created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const preview = (note?.body || '').trim();
          const handleNotificationClick = async () => {
            // Mark as read if from user notifications
            if (note.docRef && !note.read) {
              try {
                await updateDoc(note.docRef, { read: true });
              } catch (err) {
                console.warn('Error marking as read:', err);
              }
            }
            navigate(`/notification/${note.id}`, { state: { note } });
          };

          return (
            <ListItem
              key={note.id}
              divider
              onClick={handleNotificationClick}
              sx={{
                cursor: 'pointer',
                px: 2,
                py: 1.25,
                backgroundColor: !note.read && note.source === 'user' ? 'action.hover' : 'transparent',
                transition: 'background-color 0.2s',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box display="flex" alignItems="flex-start">
                  {!note.read && note.source === 'user' && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'primary.main', mr: 1, mt: 1.5, flexShrink: 0 }} />
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: note.read ? 500 : 700, flex: 1, pr: 1, opacity: note.read ? 0.7 : 1 }} noWrap>
                    {note.title || 'Notification'}
                  </Typography>
                  {timeStr && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {timeStr}
                    </Typography>
                  )}
                </Box>
                {preview && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {preview}
                  </Typography>
                )}
              </Box>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};
export default NotificationsPage;
