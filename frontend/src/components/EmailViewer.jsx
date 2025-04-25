import React, { useRef, useEffect } from 'react';

const styles = {
  viewer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    paddingBottom: '10px',
    borderBottom: '1px solid #ccc',
    marginBottom: '10px',
    fontSize: '0.9em',
    color: '#333',
  },
  headerItem: {
    marginBottom: '4px',
  },
  iframe: {
    flexGrow: 1, // Take remaining space
    border: 'none', // Remove default border
    width: '100%',
  },
};

function EmailViewer({ emailData }) {
  const iframeRef = useRef(null);

  // Use useEffect to update iframe content safely when emailData changes
  useEffect(() => {
    if (iframeRef.current && emailData?.html) {
      const iframeDoc = iframeRef.current.contentWindow.document;
      iframeDoc.open();
      // Basic sandboxing for security - consider adding more restrictions if needed
      iframeRef.current.setAttribute('sandbox', 'allow-same-origin'); 
      iframeDoc.write(emailData.html);
      iframeDoc.close();
    } else if (iframeRef.current && emailData?.text) {
        // Fallback for text emails
        const iframeDoc = iframeRef.current.contentWindow.document;
        iframeDoc.open();
        iframeRef.current.setAttribute('sandbox', 'allow-same-origin'); 
        // Wrap text in <pre> for formatting
        iframeDoc.write(`<pre>${document.createTextNode(emailData.text).textContent}</pre>`); 
        iframeDoc.close();
    } else if (iframeRef.current) {
        // Clear iframe if no data
        const iframeDoc = iframeRef.current.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write('');
        iframeDoc.close();
    }
  }, [emailData]); // Re-run when emailData changes

  if (!emailData) {
    return <p>Select an email to view its content.</p>;
  }

  const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
          return new Date(dateString).toLocaleString();
      } catch (e) {
          return dateString;
      }
  };

  return (
    <div style={styles.viewer}>
      <h2>Email Content</h2>
      <div style={styles.header}>
        <div style={styles.headerItem}><strong>Subject:</strong> {emailData.subject || '(No Subject)'}</div>
        <div style={styles.headerItem}><strong>From:</strong> {emailData.from_address || '(No Sender)'}</div>
        <div style={styles.headerItem}><strong>To:</strong> {emailData.to_address || '(No Recipient)'}</div>
        <div style={styles.headerItem}><strong>Date:</strong> {formatDate(emailData.date)}</div>
      </div>
      {/* Render HTML content in a sandboxed iframe */}
      <iframe
        ref={iframeRef}
        title="Email Content"
        style={styles.iframe}
        // sandbox attribute is set in useEffect for better control
      />
    </div>
  );
}

export default EmailViewer;