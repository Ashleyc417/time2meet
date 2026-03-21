import {
  signUp,
  confirmSignUp,
  signIn,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

export async function cognitoSignUp(
  name: string,
  email: string,
  password: string,
) {
  return signUp({
    username: email,
    password,
    options: {
      userAttributes: { email, name },
    },
  });
}

export async function cognitoConfirmSignUp(email: string, code: string) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

export async function cognitoSignIn(email: string, password: string) {
  return signIn({ username: email, password });
}

export async function cognitoResetPassword(email: string) {
  return resetPassword({ username: email });
}

export async function cognitoConfirmResetPassword(
  email: string,
  code: string,
  newPassword: string,
) {
  return confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}
