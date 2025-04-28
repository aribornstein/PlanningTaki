# 🎯 What is Planning Taki?

**Planning Taki** is an advanced variation of traditional Planning Poker.  
It blends **agile task estimation** with **personal sprint capacity management** and **dynamic reprioritization**, ensuring sprint planning is **fast**, **fair**, and **realistic**.

---

# 🕹️ How Planning Taki Works

## 1. Sprint Setup
- Each team member joins the Planning Taki session.
- Each player is assigned a **Story Point Budget**, representing their maximum sprint workload for the sprint.

Example:

| Player | Story Point Budget |
|--------|--------------------|
| Alice  | 20 points |
| Bob    | 18 points |
| Charlie| 15 points |

---

## 2. Task Selection
- One task is selected at a time for estimation.
- Each task has an assigned **owner** (the player responsible for completing the work).

---

## 3. Task Explanation Phase
- Before voting begins, the **task owner** has **2 minutes** to explain the task:
  - Scope
  - Risks
  - Acceptance Criteria
- A visible countdown timer runs.
- The owner may click "**Done Explaining**" early if finished before time expires.

---

## 4. Voting Phase
- After explanation, **everyone votes** by selecting a Fibonacci card (1, 2, 3, 5, 8, 13, 21, etc.).

**Voting Rules:**
- Players can **only pick estimates** **≤ owner's remaining Story Points**.
- Votes are hidden until revealed.

### 4.1 Special Case: Reprioritization Vote
- If a voter feels the task **deserves more points** than the owner has left:
  - They can click "**Propose Reprioritization**."
- This triggers a **team-wide Yes/No vote**.
- **Majority Yes** triggers a **Reprioritization Phase**:
  - Team reviews the owner's already-assigned tasks.
  - Tasks can be dropped, postponed, or adjusted to free up space.
- **If enough space is created**:
  - Voting resumes normally.
- **If not enough space**:
  - The task is marked as **Remaining Work** and pushed to the next sprint.

---

## 5. Reveal Phase
- All votes are revealed simultaneously.
- The team sees everyone's selected estimates.

---

## 6. Owner Response: Accept or Dispute
- **The task owner** reviews the revealed estimation.
- Two options:
  - **Accept Estimate**: Approve and proceed.
  - **Dispute Estimate**: Trigger a **1-minute discussion** followed by a **Revote**.

### Dispute Rules:
- Each owner has a maximum of **2 disputes per sprint**.
- After a 1-minute discussion, a **mandatory revote** occurs.
- **The second vote is final** — no additional disputes allowed for the same task.

---

## 7. Remaining Work
- Any task that cannot fit into the owner's available story points, even after reprioritization, becomes **Remaining Work**.
- Remaining Work tasks are scheduled for future sprints automatically.

---

# ⚡ Key Differences from Traditional Planning Poker

| Traditional Planning Poker | Planning Taki |
|-----------------------------|---------------|
| Unlimited voting options | Voting limited by owner's remaining story points |
| No sprint capacity tracking | Personal story point budgets for players |
| Informal disputes | Formal limited disputes (max 2 per owner) |
| No task reprioritization during planning | Structured reprioritization vote allowed |
| No formal Remaining Work management | Tasks overflow cleanly into Remaining Work |

---

# 🎨 Why Use Planning Taki?

- **Respects personal capacity**: No overloading team members.
- **Enforces honest estimations**: Realistic voting within constraints.
- **Supports ownership**: Owners can protect complex stories.
- **Maintains momentum**: Limited dispute use and democratic reprioritization.
- **Handles overflow cleanly**: Tasks that don’t fit are formally pushed to future sprints.

---

# 🚀 Future Enhancements

- Anonymous voting option
- Stretch capacity settings (optional sprint buffer)
- Visual indicators for Remaining Work
- Sprint analytics and player velocity charts

---

# 📬 Summary

Planning Taki is a **smarter, more agile** way to do sprint planning.  
It ensures **fairness**, **accuracy**, and **team flexibility** while keeping meetings efficient and decisions democratic.

---

# 🛠 Example Process Flow

```plaintext
[Task Selected] 
    ↓
[Owner Explains Task (2 min)]
    ↓
[Voting Phase] 
    ↳ (Propose Reprioritization? → Team Vote → Reprioritize if needed)
    ↓
[Reveal Votes]
    ↓
[Owner: Accept or Dispute?]
    ↳ (If Dispute → 1-minute discussion → Revote)
    ↓
[Update Points or Mark Remaining Work]
    ↓
[Next Task]
    ↓
[Sprint Complete]
```

---

# 📢 Contributions

Have ideas to improve Planning Taki?  
Feel free to submit new suggestions, scenarios, or variations!

---

# 🚀 Quickstart Guide: Running a Planning Taki Session

---

## 1. Set Up Your Planning Taki App
- Deploy the Planning Taki tool (local server, web app, or cloud-based).
- Ensure all team members can access the app.
- Optionally assign a **Session Moderator** to guide the flow.

---

## 2. Initialize the Sprint Planning
- Each player joins the session and enters:
  - Their **name**.
  - Their **personal Story Point Budget**.
- Confirm all players are connected.

---

## 3. Begin Task Estimation
- Select the first task for voting.
- Assign an **owner** to the task.

---

## 4. Task Explanation
- The owner has **2 minutes** to explain the story.
- The owner may click "Done Explaining" if finished early.

---

## 5. Voting Phase
- Players vote based on the owner's **remaining Story Points**.
- Votes greater than the owner's capacity are **disabled**.

### Propose Reprioritization (Optional)
- Voters can propose reprioritization if needed.
- Team votes Yes/No.
- **Majority Yes** → Reprioritize phase.
- **Majority No** → Continue voting.

---

## 6. Reveal Votes
- All votes are revealed at once.

---

## 7. Owner Response
- Owner **Accepts** or **Disputes**.
- If Dispute:
  - 1-minute discussion.
  - Immediate Revote (final result).

---

## 8. Update Sprint Capacity
- Deduct the task’s points from the owner's remaining points.

---

## 9. Remaining Work
- Tasks that cannot fit are marked **Remaining Work**.
- Remaining Work tasks are pushed to future sprints.

---

## 10. Repeat Until All Tasks Are Estimated
- Continue until all tasks are either scheduled or moved to Remaining Work.
- Sprint Planning complete!

---

# ✨ Pro Tips
- Use disputes sparingly.
- Keep discussions timeboxed.
- Review Remaining Work at the end of planning.

---

# 📝 TODO List

## High Priority
-   **Session Manager Role:** Assign a "Manager" role to the first user joining. The Manager handles tie-breaking and reprioritization decisions instead of the task owner. Requires server logic changes (`server.js`) and potential UI updates (`Session.vue`).
-   **Abandon Task Card (Owner Only):** Add a button for the task owner during the 'vote' phase (`Session.vue`) to abandon the current task (set points to null, clear `currentTask`, return to 'lobby'). Requires new server event (`server.js`).
-   **Unbudgeted Tasks Indicator:** Display a count/list of tasks with `points: null` next to each player's name in `Session.vue`. Requires a computed property.

## Medium Priority
-   **Reprioritization Vote Indicator:** Show a "✔️ Voted" indicator next to players who have voted during the `reprVote` phase in `Session.vue`, using `s.reprVote.voters`.
-   **Export Task List:** Add an "Export Tasks" button in `Session.vue` to generate a downloadable file (CSV/text) of Task Title, Owner Name, and Points using client-side JS.

## Low Priority
-   **Edit Task Text:** Allow task owners to edit the title of their unestimated tasks in the 'lobby' phase (`Session.vue`). Requires an "Edit" button and a new socket event/handler (`server.js`).
-   **Choose Player Emoji:** Add an emoji selector in `Lobby.vue`, send it with the `join` event, store it in `server.js`, and display it next to player names in `Session.vue`.
-   **Collapsible User Task Lists:** Make the "Budgeted Tasks" list under each player collapsible/expandable in `Session.vue` using local component state.

---

# ✨ End of README ✨
