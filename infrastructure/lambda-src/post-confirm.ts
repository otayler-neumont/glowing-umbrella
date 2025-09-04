import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Context } from 'aws-lambda';

type PostConfirmationEvent = {
  userPoolId: string;
  region?: string;
  userName: string;
};

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: PostConfirmationEvent, _context: Context) => {
  const groupName = process.env.DEFAULT_GROUP || 'player';
  const userPoolId = event.userPoolId;
  const username = event.userName;

  try {
    await client.send(new AdminAddUserToGroupCommand({
      GroupName: groupName,
      UserPoolId: userPoolId,
      Username: username,
    }));
    console.log('Added user to group', { username, groupName });
  } catch (err) {
    console.error('Failed to add user to group', { username, groupName, err });
  }

  return event;
};


