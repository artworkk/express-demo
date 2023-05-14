import { DbOnly, DataModelUser } from "./db-only";
import { User } from "../../../../../domain/entities/user";
import { IUser } from "../../../../../domain/entities/user";

function dataModelUserToIUser(user: DataModelUser): IUser {
  return new User(user.email, user.id);
}

function dataModelUsersToIUsers(users: DataModelUser[]): IUser[] {
  return users.map((user) => dataModelUserToIUser(user));
}

// Allows create empty group with name and owner as member,
// but will not create new group members (models UserOnGroup and User)
interface UserCreateGroup {
  name: string;
}

type IDataModelUser = Omit<DataModelUser, DbOnly>;

interface IDataModelUserWithOwnGroups extends IDataModelUser {
  password: string;
  ownGroups: {
    create: UserCreateGroup[] | undefined;
  };
}

function mapUserCreateGroups(
  groupNames: string[] | undefined,
): UserCreateGroup[] | undefined {
  if (!groupNames) {
    return undefined;
  }

  return groupNames.map((groupName) => {
    return { name: groupName };
  });
}

function formCreateUserToDataModelUser(
  user: IUser,
  password: string,
): IDataModelUserWithOwnGroups {
  return {
    id: user.id,
    email: user.email,
    password,
    ownGroups: {
      create: mapUserCreateGroups(user.groupsOwned()),
    },
  };
}

export default {
  dataModelUserToIUser,
  dataModelUsersToIUsers,
  formCreateUserToDataModelUser,
};
