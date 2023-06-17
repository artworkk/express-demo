import postgres, { DbDriver } from "../../src/data/sources/postgres";
import links, {
  IDataLinkClipboard,
  IDataLinkGroup,
  IDataLinkUser,
} from "../../src/data/sources/postgres/data-links";

import repo from "../../src/domain/repositories";

import { IRepositoryClipboard } from "../../src/domain/interfaces/repositories/clipboard";

import { GroupOwner } from "../../src/domain/entities/group-owner";
import { Group } from "../../src/domain/entities/group";
import { User } from "../../src/domain/entities/user";
import { IClipboard, Clipboard } from "../../src/domain/entities/clipboard";

import { clearDb } from "../util";

interface Arg {
  owner: string;
  members: string[];
  nonMembers: string[];
  dbDriver: DbDriver;
  dataLinkUser: IDataLinkUser;
  dataLinkGroup: IDataLinkGroup;
  dataLinkClipboard: IDataLinkClipboard;
}

describe("groups and clipboards", () => {
  const arg: Arg = {
    owner: "clipboard.test-ownerUser",
    members: [
      "clipboard.test-member1",
      "clipboard.test-member2",
      "clipboard.test-member3",
    ],
    nonMembers: [
      "clipboard.test-user1",
      "clipboard.test-user2",
      "clipboard.test-user3",
    ],
    dbDriver: postgres,
    dataLinkUser: links.newDataLinkUser(postgres),
    dataLinkGroup: links.newDataLinkGroup(postgres),
    dataLinkClipboard: links.newDataLinkClipboard(postgres),
  };

  test("membership visibility", async () => {
    try {
      await clearDb(arg.dbDriver);
      await testGroupClipboards(arg);
      await clearDb(arg.dbDriver);
    } catch (err) {
      // Clear databases after error too
      console.error(`Got error: ${err}`);
      await clearDb(arg.dbDriver);

      console.log(`Cleared DB`);
    }
  });
});

async function testGroupClipboards(arg: Arg): Promise<void> {
  const repoUser = repo.newRepositoryUser(arg.dataLinkUser);
  const repoGroup = repo.newRepositoryGroup(arg.dataLinkGroup);
  const repoClipboard = repo.newRepositoryClipboard(arg.dataLinkClipboard);

  console.log("Creating group owner user");
  const ownerUser = await repoUser.createUser(
    new User({ email: arg.owner }),
    "ownerPass",
  );

  console.log("Creating group members");
  const members = await Promise.all(
    arg.members.map((email, i) =>
      repoUser.createUser(new User({ email }), `passMem${i + 1}`),
    ),
  );

  console.log("Creating non-members");
  const nonMembers = await Promise.all(
    arg.nonMembers.map((email, i) =>
      repoUser.createUser(new User({ email }), `passMem${i + 1}`),
    ),
  );

  console.log("Creating group");
  const group = await repoGroup.createGroup(
    new Group({
      name: "groupName",
      owner: new GroupOwner({ id: ownerUser.id, email: ownerUser.email }),
      users: members,
    }),
  );

  console.log("Creating owner clipboard");
  const ownerClips = await createClipboards(repoClipboard, [
    new Clipboard({ content: "ownerClip1", user: ownerUser, shared: true }),
    new Clipboard({ content: "ownerClip2", user: ownerUser, shared: true }),
  ]);

  members.forEach(async (member) => {
    const ownerGroupClips = await repoClipboard.getUserGroupsClipboards(
      member.id,
    );
    if (!ownerGroupClips) {
      return Promise.reject("null groupClips");
    }

    expect(ownerGroupClips.length).toEqual(ownerClips.length);
    ownerGroupClips.forEach((clip) =>
      expect(clip.getUserId()).toEqual(ownerUser.id),
    );
  });

  console.log("Creating non-members' clipboards");
  const nonMemberClips = await Promise.all(
    nonMembers.map(async (nonMem, i) => {
      return repoClipboard.createClipboard(
        new Clipboard({
          title: `nonMember${i + 1} note`,
          content: `nonMember${i + 1} note`,
          user: nonMem,
          shared: true,
        }),
      );
    }),
  );

  const memberSharedClips = await Promise.all(
    members.map(async (member, i) => {
      return repoClipboard.createClipboard(
        new Clipboard({
          title: `member${i + 1} note`,
          content: `member${i + 1} note`,
          user: member,
          shared: true,
        }),
      );
    }),
  );

  const groupClipboards = await repoClipboard.getGroupClipboards(group.id);
  if (!groupClipboards) {
    return Promise.reject("null groupClipboards");
  }
  if (groupClipboards.length === 0) {
    return Promise.reject("0 group clipboards");
  }
  expect(groupClipboards.length).toEqual(
    ownerClips.length + memberSharedClips.length,
  );
  groupClipboards.forEach((groupClip) => {
    nonMemberClips.forEach((nonGroupClip) =>
      expect(groupClip.id === nonGroupClip.id).toEqual(false),
    );
  });

  // We only have 1 group, so getUserGroupClipboards should return
  // the same number of clipboards as groupClipboards
  await Promise.all(
    members.map(
      async (member): Promise<[string, Promise<IClipboard[] | null>]> => {
        return [
          member.id,
          repoClipboard.getUserGroupClipboards(member.id, group.id),
        ];
      },
    ),
  ).then((membersResults) => {
    membersResults.forEach(async (memberResult) => {
      const clipboards = await memberResult[1];
      if (!clipboards) {
        return Promise.reject(
          `null groupClipboards for member ${memberResult[0]}`,
        );
      }

      expect(clipboards.length).toEqual(groupClipboards.length);
    });
  });

  // Members should not see non-members' clips
  members.forEach(async (member) => {
    const groupsClipboards = await repoClipboard.getUserGroupsClipboards(
      member.id,
    );
    if (!groupsClipboards) {
      return Promise.reject("null groupClips");
    }

    expect(groupsClipboards.length).toEqual(
      ownerClips.length + memberSharedClips.length,
    );
    groupsClipboards.forEach((clip) => {
      nonMemberClips.forEach((nonMemClip) =>
        expect(clip.id === nonMemClip.id).toEqual(false),
      );
    });
  });

  const memberPrivateClips = await Promise.all(
    members.map(async (member, i) => {
      return repoClipboard.createClipboard(
        new Clipboard({
          title: `member${i + 1} private note`,
          content: `member${i + 1} private note`,
          user: member,
          shared: false,
        }),
      );
    }),
  );

  // Members should only see shared clips
  members.forEach(async (member) => {
    const groupsClipboards = await repoClipboard.getUserGroupsClipboards(
      member.id,
    );
    if (!groupsClipboards) {
      return Promise.reject("null groupClips");
    }

    expect(groupsClipboards.length).toEqual(
      ownerClips.length + memberSharedClips.length,
    );
    groupsClipboards.forEach((clip) => {
      nonMemberClips.forEach((nonMemClip) =>
        expect(clip.id === nonMemClip.id).toEqual(false),
      );
      memberPrivateClips.forEach((privateClip) => {
        expect(clip.id === privateClip.id).toEqual(false);
      });
    });
  });

  return Promise.resolve();
}

async function createClipboards(
  repo: IRepositoryClipboard,
  clipboards: IClipboard[],
): Promise<IClipboard[]> {
  return await Promise.all(
    clipboards.map((clip) => repo.createClipboard(clip)),
  );
}
