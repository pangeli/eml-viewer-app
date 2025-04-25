import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FolderTree from './components/FolderTree';
import EmailList from './components/EmailList';
import EmailViewer from './components/EmailViewer';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [structure, setStructure] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [selectedEmailData, setSelectedEmailData] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingEmailContent, setLoadingEmailContent] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Input field value
  const [currentSearch, setCurrentSearch] = useState(''); // The term currently being searched for

  // Fetch folder structure on component mount
  useEffect(() => {
    const fetchStructure = async () => {
      try {
        setError('');
        const response = await axios.get(`${API_BASE_URL}/structure`);
        setStructure(response.data);
      } catch (err) {
        console.error("Error fetching structure:", err);
        setError(`Failed to load folder structure: ${err.response?.data?.error || err.message}`);
      }
    };
    fetchStructure();
  }, []);

  // Function to fetch emails for the selected folder and optional search term
  const fetchEmails = async (user, folder, search = '') => {
    if (!user || !folder) return;
    setLoadingEmails(true);
    setError('');
    setEmails([]);
    setSelectedEmailId(null);
    setSelectedEmailData(null);
    setCurrentSearch(search); // Store the search term being used

    try {
      const response = await axios.get(`${API_BASE_URL}/emails`, {
        params: {
            user,
            folder,
            limit: 100, // Adjust limit as needed
            search: search || null // Pass search term to API (null if empty)
        }
      });
      setEmails(response.data.data || []); // Ensure emails is always an array
    } catch (err) {
      console.error(`Error fetching emails for ${user}/${folder} (search: ${search}):`, err);
      setError(`Failed to load emails: ${err.response?.data?.error || err.message}`);
      setEmails([]); // Ensure emails is an array on error
    } finally {
      setLoadingEmails(false);
    }
  };

  // Handler for selecting a folder
  const handleSelectFolder = (user, folder) => {
    setSelectedUser(user);
    setSelectedFolder(folder);
    setSearchTerm(''); // Clear search input
    setCurrentSearch(''); // Clear current search state
    fetchEmails(user, folder); // Fetch emails without search term
  };

  // Handler for selecting an email - Fetches content
  const handleSelectEmail = async (emailId) => {
    if (selectedEmailId === emailId) return; // Avoid re-fetching if already selected

    setSelectedEmailId(emailId);
    setSelectedEmailData(null); // Clear previous content
    setLoadingEmailContent(true); // Set loading state
    setError(''); // Clear previous errors

    try {
      const response = await axios.get(`${API_BASE_URL}/emails/${emailId}`);
      setSelectedEmailData(response.data);
    } catch (err) {
      console.error(`Error fetching email content for ID ${emailId}:`, err);
      setError(`Failed to load email content: ${err.response?.data?.error || err.message}`);
      setSelectedEmailData(null); // Clear data on error
    } finally {
      setLoadingEmailContent(false); // Clear loading state
    }
  };

  // Handler for search input change
  const handleSearchInputChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Handler for triggering search (button click or Enter key)
  const handleSearch = (event) => {
      // Allow triggering via Enter key press in the input
      if (event && event.key && event.key !== 'Enter') {
          return;
      }
      // Prevent form submission if triggered by Enter key
      if (event && event.preventDefault) {
          event.preventDefault();
      }
      // Fetch emails with the current search term
      if (selectedUser && selectedFolder) {
          fetchEmails(selectedUser, selectedFolder, searchTerm);
      }
  };

  return (
    <div className="App">
      <h1>EML Viewer</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', height: 'calc(100vh - 50px)' }}> {/* Main layout container */}

        {/* FolderTree Pane */}
        <div style={{ width: '250px', borderRight: '1px solid #ccc', paddingRight: '10px', overflowY: 'auto', flexShrink: 0 }}>
          <FolderTree
            structure={structure}
            onSelectFolder={handleSelectFolder}
            selectedUser={selectedUser}
            selectedFolder={selectedFolder}
          />
        </div>

        {/* EmailList Pane (includes Search) */}
        <div style={{ flex: 1, paddingLeft: '10px', display: 'flex', flexDirection: 'column', minWidth: '300px' }}> {/* Added minWidth */}
          {/* Search Bar - Only show if a folder is selected */}
          {selectedFolder && (
            <div style={{ padding: '5px 0', borderBottom: '1px solid #eee', marginBottom: '5px', flexShrink: 0 }}>
              <input
                type="text"
                placeholder={`Search in ${selectedFolder}...`}
                value={searchTerm}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearch} // Trigger search on Enter
                style={{ marginRight: '5px', padding: '4px', width: 'calc(100% - 130px)' }} // Adjust width
                disabled={!selectedFolder} // Disable if no folder selected
              />
              <button onClick={handleSearch} disabled={!selectedFolder}>Search</button>
              {/* Optionally show clear search button if a search is active */}
              {currentSearch && (
                  <button onClick={() => { setSearchTerm(''); fetchEmails(selectedUser, selectedFolder, ''); }} style={{marginLeft: '5px'}}>Clear</button>
              )}
            </div>
          )}

          {/* Email List */}
          <div style={{ flex: 1, overflowY: 'auto' }}> {/* Make list scrollable */}
            {loadingEmails ? (
              <p>Loading emails...</p>
            ) : (
              <EmailList
                emails={emails}
                onSelectEmail={handleSelectEmail}
                selectedEmailId={selectedEmailId}
              />
            )}
          </div>
        </div>

        {/* EmailViewer Pane */}
        <div style={{ width: '50%', borderLeft: '1px solid #ccc', paddingLeft: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {loadingEmailContent ? (
             <p>Loading content for email {selectedEmailId}...</p>
          ) : (
             <EmailViewer emailData={selectedEmailData} />
          )}
        </div>

      </div>
    </div>
  );
}

export default App;