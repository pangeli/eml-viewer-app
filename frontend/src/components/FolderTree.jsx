import React from 'react';

// Basic styling for the tree
const styles = {
  user: {
    fontWeight: 'bold',
    marginTop: '10px',
  },
  folder: {
    marginLeft: '15px',
    cursor: 'pointer',
    padding: '2px 0',
  },
  selectedFolder: {
    marginLeft: '15px',
    cursor: 'pointer',
    padding: '2px 0',
    backgroundColor: '#e0e0e0', // Highlight selected folder
  }
};

function FolderTree({ structure, onSelectFolder, selectedUser, selectedFolder }) {
  if (!structure) {
    return <p>Loading folder structure...</p>;
  }

  const users = Object.keys(structure);

  return (
    <div>
      <h2>Folders</h2>
      {users.length === 0 && <p>No folders found.</p>}
      {users.map(user => (
        <div key={user}>
          <div style={styles.user}>{user}</div>
          {structure[user].map(folder => (
            <div
              key={`${user}-${folder}`}
              style={user === selectedUser && folder === selectedFolder ? styles.selectedFolder : styles.folder}
              onClick={() => onSelectFolder(user, folder)} // Call handler on click
            >
              {folder}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default FolderTree;