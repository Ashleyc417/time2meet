import React, { useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import ButtonWithSpinner from './ButtonWithSpinner';
import { cognitoConfirmSignUp, cognitoSignIn } from 'utils/cognito-auth';
import { useAppDispatch } from 'app/hooks';
import { loadTokenFromCognito } from 'slices/authentication';
import { useNavigate } from 'react-router-dom';


export default function VerifyEmailCode({ email, password }: { email: string, password: string }) {
  const [validated, setValidated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

   const onSubmit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await cognitoConfirmSignUp(email, codeRef.current!.value);
      await cognitoSignIn(email, password);  // sign in after verification
      
      // temp
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      console.log('session after login:', session);
      console.log('tokens:', session.tokens);
      console.log('localStorage keys:', Object.keys(localStorage));

      await dispatch(loadTokenFromCognito()); // load token into Redux
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="align-self-center" style={{ maxWidth: '600px' }}>
      <h3>Verify your email</h3>
      <hr className="my-4" />
      <p>
        A 6-digit confirmation code was sent to <strong>{email}</strong>.
        Please enter it below.
      </p>
      <Form noValidate validated={validated} onSubmit={onSubmit}>
        <Form.Group controlId="verify-code">
          <Form.Label>Confirmation code</Form.Label>
          <Form.Control
            required
            placeholder="Enter your 6-digit code"
            className="form-text-input"
            ref={codeRef}
          />
          <Form.Control.Feedback type="invalid">
            Please enter your confirmation code.
          </Form.Control.Feedback>
        </Form.Group>
        {error && (
          <p className="text-danger text-center mb-0 mt-3">
            An error occurred: {error}
          </p>
        )}
        <div className="d-flex justify-content-end mt-4">
          <ButtonWithSpinner
            type="submit"
            className="btn btn-outline-primary"
            isLoading={isLoading}
          >
            Verify
          </ButtonWithSpinner>
        </div>
      </Form>
    </div>
  );
}