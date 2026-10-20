/** Demo accounts created by seed-dev.ts. They exist only in the dev project. */
export const DEMO_PASSWORD = "ktcord-demo-password"

export const DEMO_USERS = [
  { username: "demo_ava", display: "Ava", banner: "#eb459e", bio: "Runs the lounge. Ask me about the rules." },
  { username: "demo_ben", display: "Ben", banner: "#3ba55c", bio: "Mostly here for the memes." },
  { username: "demo_cy", display: "Cy", banner: "#faa61a", bio: "Night owl 🦉" },
] as const

export const demoEmail = (username: string) => `${username}@ktcord.test`
