import React from 'react';

// Basic styling for the list
const styles = {
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    maxHeight: 'calc(100vh - 150px)', // Example height, adjust as needed
    overflowY: 'auto',
  },
  listItem: {
    borderBottom: '1px solid #eee',
    padding: '8px 5px',
    cursor: 'pointer',
  },
  selectedListItem: {
    borderBottom: '1px solid #eee',
    padding: '8px 5px',
    cursor: 'pointer',
    backgroundColor: '#e0e0e0', // Highlight selected email
  },
  subject: {
    fontWeight: 'bold',
    fontSize: '0.9em',
    marginBottom: '3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  from: {
    fontSize: '0.8em',
    color: '#555',
  },
  date: {
      fontSize: '0.75em',
      color: '#777',
      float: 'right', // Position date to the right
  }
};

function EmailList({ emails, onSelectEmail, selectedEmailId }) {

  const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
          const date = new Date(dateString);
          // Format as YYYY-MM-DD HH:MM
          return date.toLocaleString('sv-SE', { // Use a locale that gives YYYY-MM-DD format
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          });
      } catch (e) {
          return dateString; // Return original if parsing fails
      }
  };


  if (!emails || emails.length === 0) {
    return <p>Select a folder or no emails found.</p>;
  }

  return (
    <div>
        <h2>Emails ({emails.length})</h2>
        <ul style={styles.list}>
        {emails.map(email => (
            <li
            key={email.id}
            style={email.id === selectedEmailId ? styles.selectedListItem : styles.listItem}
            onClick={() => onSelectEmail(email.id)} // Call handler on click
            >
            <div style={styles.date}>{formatDate(email.date)}</div>
            <div style={styles.subject}>{email.subject || '(No Subject)'}</div>
            <div style={styles.from}>{email.from_address || '(No Sender)'}</div>
            </li>
        ))}
        </ul>
    </div>
  );
}

export default EmailList;