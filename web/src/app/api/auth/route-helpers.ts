import { amplifyAuthConfig } from '@/lib/aws';
import { Amplify } from 'aws-amplify';
import { signUp, confirmSignUp, signIn, type SignInInput } from 'aws-amplify/auth';

let configured = false;
function ensureConfigured(){
  if(!configured){
    Amplify.configure(amplifyAuthConfig);
    configured = true;
  }
}

export async function doSignup(email: string, password: string){
  ensureConfigured();
  return await signUp({ username: email, password, options: { userAttributes: { email } }});
}

export async function doConfirm(email: string, code: string){
  ensureConfigured();
  return await confirmSignUp({ username: email, confirmationCode: code });
}

export async function doSignin(email: string, password: string){
  ensureConfigured();
  return await signIn({ username: email, password } as SignInInput);
}
