import { beforeEach, describe, expect, it } from "vitest";
import { api, prisma, resetDb } from "./helpers";

const creds = { name: "Asha Rao", email: "asha@aurelle.test", password: "Secret123" };

async function registerAndLogin() {
  await api().post("/api/auth/register").send(creds).expect(201);
  const res = await api().post("/api/auth/login").send({ email: creds.email, password: creds.password }).expect(200);
  return res.body.data.token as string;
}

describe("auth", () => {
  beforeEach(resetDb);

  it("registers a CUSTOMER and never exposes the password hash", async () => {
    const res = await api().post("/api/auth/register").send(creds).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: creds.email, role: "CUSTOMER" });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.token).toEqual(expect.any(String));

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: creds.email } });
    expect(stored.passwordHash).not.toBe(creds.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a client-supplied role instead of trusting it", async () => {
    const res = await api().post("/api/auth/register").send({ ...creds, role: "ADMIN" }).expect(400);
    expect(res.body.success).toBe(false);
    expect(await prisma.user.count()).toBe(0);
  });

  it("promotes only emails listed in ADMIN_EMAILS", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ ...creds, email: "BOSS@aurelle.test" })
      .expect(201);
    expect(res.body.data.user.role).toBe("ADMIN");
  });

  it("normalises email case and rejects duplicates with 409", async () => {
    await api().post("/api/auth/register").send(creds).expect(201);
    const res = await api().post("/api/auth/register").send({ ...creds, email: "ASHA@Aurelle.test" }).expect(409);
    expect(res.body.message).toMatch(/already exists/);
  });

  it("returns field errors for invalid input", async () => {
    const res = await api().post("/api/auth/register").send({ name: "A", email: "nope", password: "short" }).expect(400);
    expect(res.body).toMatchObject({ success: false, message: "Some fields are invalid" });
    const paths = res.body.errors.map((e: { path: string }) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("gives the same 401 for an unknown email and a wrong password", async () => {
    await api().post("/api/auth/register").send(creds).expect(201);
    const a = await api().post("/api/auth/login").send({ email: creds.email, password: "Wrong1234" }).expect(401);
    const b = await api().post("/api/auth/login").send({ email: "ghost@aurelle.test", password: "Wrong1234" }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it("requires a valid token for /me", async () => {
    await api().get("/api/auth/me").expect(401);
    await api().get("/api/auth/me").set("Authorization", "Bearer not.a.jwt").expect(401);
    const token = await registerAndLogin();
    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.data.user.email).toBe(creds.email);
  });

  it("revokes the token on logout", async () => {
    const token = await registerAndLogin();
    await api().post("/api/auth/logout").set("Authorization", `Bearer ${token}`).expect(200);
    await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("signs out other sessions when the password changes", async () => {
    const tokenA = await registerAndLogin();
    const tokenB = (await api().post("/api/auth/login").send(creds).expect(200)).body.data.token;

    await api()
      .put("/api/me/password")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ currentPassword: "Wrong1234", newPassword: "NewSecret456" })
      .expect(400);

    const res = await api()
      .put("/api/me/password")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ currentPassword: creds.password, newPassword: "NewSecret456" })
      .expect(200);

    await api().get("/api/auth/me").set("Authorization", `Bearer ${tokenA}`).expect(401);
    await api().get("/api/auth/me").set("Authorization", `Bearer ${tokenB}`).expect(401);
    await api().get("/api/auth/me").set("Authorization", `Bearer ${res.body.data.token}`).expect(200);
    await api().post("/api/auth/login").send({ email: creds.email, password: "NewSecret456" }).expect(200);
  });

  it("resets a password with a single-use token", async () => {
    const oldToken = await registerAndLogin();

    const unknown = await api().post("/api/auth/forgot-password").send({ email: "ghost@aurelle.test" }).expect(200);
    const known = await api().post("/api/auth/forgot-password").send({ email: creds.email }).expect(200);
    expect(known.body.data.message).toBe(unknown.body.data.message); // no account enumeration
    expect(unknown.body.data.devResetUrl).toBeUndefined();

    const resetToken = new URL(known.body.data.devResetUrl).searchParams.get("token")!;
    await api().post("/api/auth/reset-password").send({ token: resetToken, password: "Brand1New" }).expect(200);
    await api().post("/api/auth/reset-password").send({ token: resetToken, password: "Again1New" }).expect(400);

    await api().get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`).expect(401);
    await api().post("/api/auth/login").send({ email: creds.email, password: "Brand1New" }).expect(200);
  });

  it("updates profile name and saved address", async () => {
    const token = await registerAndLogin();
    const auth = { Authorization: `Bearer ${token}` };
    const r1 = await api().patch("/api/me").set(auth).send({ name: "Asha R." }).expect(200);
    expect(r1.body.data.user.name).toBe("Asha R.");

    const address = { fullName: "Asha", phone: "9876543210", line1: "1 Park St", city: "Kolkata", state: "WB", postalCode: "700016" };
    const r2 = await api().put("/api/me/address").set(auth).send({ address }).expect(200);
    expect(r2.body.data.user.address).toMatchObject({ ...address, country: "India" });
    await api().put("/api/me/address").set(auth).send({ address: { ...address, postalCode: "12" } }).expect(400);
  });
});
