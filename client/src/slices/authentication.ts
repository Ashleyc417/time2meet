// import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// import type { AppThunk, RootState } from 'app/store';
// import { getLocalToken, removeLocalToken, setLocalToken } from 'utils/auth.utils';

// export type AuthenticationState = {
//   token: string | null;
// };

// const initialState: AuthenticationState = {
//   token: getLocalToken(),
// };

// export const authenticationSlice = createSlice({
//   name: 'authentication',
//   initialState: initialState as AuthenticationState,  // needed to prevent type narrowing
//   reducers: {
//     setTokenInternal: (state, {payload: token}: PayloadAction<string | null>) => {
//       state.token = token;
//     },
//   },
// });

// const { setTokenInternal } = authenticationSlice.actions;

// export const setToken =
//   (token: string): AppThunk =>
//   (dispatch) => {
//     setLocalToken(token);
//     dispatch(setTokenInternal(token));
//   };
// export const removeToken =
//   (): AppThunk =>
//   (dispatch) => {
//     removeLocalToken();
//     dispatch(setTokenInternal(null));
//   };

// export const selectToken = (state: RootState) => state.authentication.token;
// export const selectTokenIsPresent = (state: RootState) => selectToken(state) !== null;
// export const selectAuth = (state: RootState) => state.authentication;

// export default authenticationSlice.reducer;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AppThunk, RootState } from 'app/store';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';

export type AuthenticationState = {
  token: string | null;
};

const initialState: AuthenticationState = {
  token: null,
};

export const authenticationSlice = createSlice({
  name: 'authentication',
  initialState: initialState as AuthenticationState,
  reducers: {
    setTokenInternal: (state, { payload: token }: PayloadAction<string | null>) => {
      state.token = token;
    },
  },
});

const { setTokenInternal } = authenticationSlice.actions;

// Call this after Cognito sign-in to load the token into Redux
export const loadTokenFromCognito =
  (): AppThunk => async (dispatch) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString() ?? null;

      //temp
      console.log('loadTokenFromCognito token:', token ? 'present' : 'null');
      dispatch(setTokenInternal(token));

      dispatch(setTokenInternal(token));
    } catch {
      dispatch(setTokenInternal(null));
    }
  };

export const removeToken =
  (): AppThunk => async (dispatch) => {
    try {
      await signOut();
    } catch {}
    dispatch(setTokenInternal(null));
  };

export const selectToken = (state: RootState) => state.authentication.token;
export const selectTokenIsPresent = (state: RootState) => selectToken(state) !== null;
export const selectAuth = (state: RootState) => state.authentication;

export default authenticationSlice.reducer;

// Backwards-compatible shim for files that still pass a token string directly
export const setToken =
  (token?: string): AppThunk =>
  (dispatch) => {
    if (token) {
      dispatch(setTokenInternal(token));
    } else {
      dispatch(loadTokenFromCognito() as any);
    }
  };