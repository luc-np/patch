import { describe, it, expect } from "vitest";
import {
  canViewTicket,
  canCreateTicket,
  canViewProject,
  canManageProjects,
  canViewTeam,
  canManageExpertise,
  canViewProjectNotes,
  canViewSuggestions,
  canPostInternalNote,
  filterVisibleMessages,
  type Actor,
  type TicketView,
} from "@/lib/auth/policies";

const PROJ = "proj-1";
const OTHER_PROJ = "proj-2";

const admin: Actor = {
  id: "u-admin",
  name: "Admin",
  email: "admin@x",
  role: "admin",
  projectIds: [],
};
const staff: Actor = {
  id: "u-staff",
  name: "Nina",
  email: "nina@x",
  role: "staff",
  projectIds: [PROJ],
};
const guestA: Actor = {
  id: "u-guest-a",
  name: "Camila",
  email: "camila@x",
  role: "guest",
  projectIds: [PROJ],
};
const guestB: Actor = {
  id: "u-guest-b",
  name: "Rui",
  email: "rui@x",
  role: "guest",
  projectIds: [PROJ],
};

const supportByA: TicketView = {
  projectId: PROJ,
  authorId: guestA.id,
  type: "support",
};
const supportByB: TicketView = {
  projectId: PROJ,
  authorId: guestB.id,
  type: "support",
};
const taskByStaff: TicketView = {
  projectId: PROJ,
  authorId: staff.id,
  type: "task",
};

describe("guest — o caso mais fácil de vazar dado", () => {
  it("1. guest não vê ticket de outro guest no mesmo projeto (vira 404 no service)", () => {
    expect(canViewTicket(guestA, supportByB)).toBe(false);
    expect(canViewTicket(guestA, supportByA)).toBe(true);
  });

  it("2. guest nunca vê task interna, mesmo sendo o 'autor' hipotético", () => {
    expect(canViewTicket(guestA, taskByStaff)).toBe(false);
    const taskWeirdlyByGuest: TicketView = {
      projectId: PROJ,
      authorId: guestA.id,
      type: "task",
    };
    expect(canViewTicket(guestA, taskWeirdlyByGuest)).toBe(false);
  });

  it("3. filterVisibleMessages remove notas internas para guest e mantém para staff", () => {
    const msgs = [
      { id: "m1", internal: false },
      { id: "m2", internal: true },
      { id: "m3", internal: false },
    ];
    expect(filterVisibleMessages(guestA, supportByA, msgs).map((m) => m.id)).toEqual(
      ["m1", "m3"],
    );
    expect(filterVisibleMessages(staff, supportByA, msgs)).toHaveLength(3);
    // ticket invisível → thread vazia, não parcial
    expect(filterVisibleMessages(guestA, supportByB, msgs)).toHaveLength(0);
  });

  it("4. guest não vê equipe, expertise, notas de projeto nem sugestões de IA", () => {
    expect(canViewTeam(guestA)).toBe(false);
    expect(canManageExpertise(guestA)).toBe(false);
    expect(canViewProjectNotes(guestA, PROJ)).toBe(false);
    expect(canViewSuggestions(guestA, supportByA)).toBe(false);
    expect(canPostInternalNote(guestA, supportByA)).toBe(false);
  });

  it("5. guest só cria chamado (nunca task) em projeto com portal ligado onde é membro", () => {
    const base = { projectId: PROJ, portalEnabled: true } as const;
    expect(canCreateTicket(guestA, { ...base, type: "support" })).toBe(true);
    expect(canCreateTicket(guestA, { ...base, type: "task" })).toBe(false);
    expect(
      canCreateTicket(guestA, { projectId: PROJ, type: "support", portalEnabled: false }),
    ).toBe(false);
    expect(
      canCreateTicket(guestA, {
        projectId: OTHER_PROJ,
        type: "support",
        portalEnabled: true,
      }),
    ).toBe(false);
  });
});

describe("staff e admin", () => {
  it("6. staff vê e opera apenas projetos onde é membro; admin vê tudo", () => {
    expect(canViewProject(staff, PROJ)).toBe(true);
    expect(canViewProject(staff, OTHER_PROJ)).toBe(false);
    expect(canViewTicket(staff, supportByB)).toBe(true);
    const foreign: TicketView = {
      projectId: OTHER_PROJ,
      authorId: guestB.id,
      type: "support",
    };
    expect(canViewTicket(staff, foreign)).toBe(false);
    expect(canViewProject(admin, OTHER_PROJ)).toBe(true);
    expect(canViewTicket(admin, foreign)).toBe(true);
  });

  it("7. staff não cria projeto, membro ou área — só admin", () => {
    expect(canManageProjects(staff)).toBe(false);
    expect(canManageExpertise(staff)).toBe(false);
    expect(canManageProjects(admin)).toBe(true);
    expect(canManageExpertise(admin)).toBe(true);
  });
});

describe("indistinguibilidade entre inexistente e invisível", () => {
  it("8. a negação de leitura é booleana e idêntica para qualquer motivo — o service converte ambos no mesmo not_found", () => {
    // Invisível (existe, mas é de outro guest) e "inexistente" produzem exatamente
    // o mesmo sinal para o chamador: false. Nenhum shape distinto para vazar timing/motivo.
    const invisible = canViewTicket(guestA, supportByB);
    expect(invisible).toBe(false);
    expect(typeof invisible).toBe("boolean");
  });
});
