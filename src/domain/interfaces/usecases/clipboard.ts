import { IClipboard } from "../../entities/clipboard";

export interface IUseCaseCreateClipboard {
  execute(clipboard: IClipboard): Promise<IClipboard>;
}

export interface IUseCaseGetUserClipboard {
  execute(arg: { userId: string; id: string }): Promise<IClipboard | null>;
}

export interface IUseCaseGetUserClipboards {
  execute(userId: string): Promise<IClipboard[] | null>;
}

export interface IUseCaseGetGroupClipboards {
  execute(userId: string, groupId: string): Promise<IClipboard[] | null>;
}

export interface IUseCaseGetGroupsClipboards {
  execute(userId: string): Promise<IClipboard[] | null>;
}

export interface IUseCaseDeleteUserClipboard {
  execute(arg: { userId: string; id: string }): Promise<IClipboard>;
}

export interface IUseCaseDeleteUserClipboards {
  execute(userId: string): Promise<number>;
}
