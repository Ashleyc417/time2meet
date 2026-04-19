// import React from 'react';
// import Form from 'react-bootstrap/Form';

// export default function MeetingAboutPrompt({
//   meetingAbout,
//   setMeetingAbout,
// }: {
//   meetingAbout: string,
//   setMeetingAbout: (about: string) => void },
// ) {
//   const onMeetingAboutChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     setMeetingAbout(e.target.value);
//   };
//   return (
//     <Form.Group controlId="meeting-about-prompt" className="create-meeting-form-group">
//       <Form.Label className="create-meeting-question">
//         What's your meeting about?
//       </Form.Label>
//       <Form.Control
//         as="textarea"
//         style={{width: '100%'}}
//         rows={3}
//         placeholder="Super important meeting to increase productivity"
//         className="form-text-input"
//         value={meetingAbout}
//         onChange={onMeetingAboutChange}
//       >
//       </Form.Control>
//     </Form.Group>
//   );
// }

import React, { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';

export default function MeetingAboutPrompt({
  meetingAbout,
  setMeetingAbout,
  meetingName,
}: {
  meetingAbout: string,
  setMeetingAbout: (about: string) => void,
  meetingName: string,
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const onMeetingAboutChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMeetingAbout(e.target.value);
  };

  const handleAutoFill = async () => {
    setIsGenerating(true);
    try {
        const res = await fetch('https://d10pcz6d75qyf0.cloudfront.net/api/bedrock/generate-description', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingName }),
      });
      const data = await res.json();
      setMeetingAbout(data.description);
    } catch (err) {
      console.error('Failed to generate description:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Form.Group controlId="meeting-about-prompt" className="create-meeting-form-group">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <Form.Label className="create-meeting-question mb-0">
          What's your meeting about?
        </Form.Label>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleAutoFill}
          disabled={!meetingName.trim() || isGenerating}
        >
          {isGenerating ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Generating...
            </>
          ) : (
            '✨ Auto-fill'
          )}
        </Button>
      </div>
      <Form.Control
        as="textarea"
        style={{ width: '100%' }}
        rows={3}
        placeholder="Super important meeting to increase productivity"
        className="form-text-input"
        value={meetingAbout}
        onChange={onMeetingAboutChange}
      />
    </Form.Group>
  );
}