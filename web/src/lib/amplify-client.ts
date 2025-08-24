'use client';
import { Amplify } from 'aws-amplify';
import { amplifyAuthConfig } from './aws';

let configured = false;
if (!configured) {
  Amplify.configure(amplifyAuthConfig);
  configured = true;
}

export {};
