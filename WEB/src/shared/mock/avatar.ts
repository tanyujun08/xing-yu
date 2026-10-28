const mockMemberAvatarSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="演示会员头像">',
  '<rect width="96" height="96" rx="24" fill="#5c6cff"/>',
  '<circle cx="48" cy="39" r="17" fill="white" fill-opacity=".94"/>',
  '<path d="M19 87c2-21 13-31 29-31s27 10 29 31" fill="white" fill-opacity=".94"/>',
  '<path d="M25 25l8-10 5 12M71 25l-8-10-5 12" fill="white" fill-opacity=".82"/>',
  '</svg>',
].join('');

export const MOCK_MEMBER_AVATAR_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mockMemberAvatarSvg)}`;
