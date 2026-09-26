-- The player's screen: coins, the question panel, the upgrade shop, and the builder.
-- Q opens questions, B opens the builder, U opens the shop. Kiosks in the plaza open them too.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local GetQuestion = Remotes:WaitForChild("GetQuestion")
local SubmitAnswer = Remotes:WaitForChild("SubmitAnswer")
local Buy = Remotes:WaitForChild("Buy")
local State = Remotes:WaitForChild("State")
local Open = Remotes:WaitForChild("Open")

local S = { coins = 0, correct = 0, answered = 0, streak = 0, best = 0, up = {}, b = {}, income = 0 }

local NAVY = Color3.fromRGB(10, 18, 34)
local PANEL = Color3.fromRGB(16, 28, 50)
local GOLD = Color3.fromRGB(255, 201, 51)
local CYAN = Color3.fromRGB(63, 216, 255)
local GREEN = Color3.fromRGB(63, 224, 158)
local RED = Color3.fromRGB(255, 92, 110)
local WHITE = Color3.new(1, 1, 1)

-- ---------- tiny UI helpers ----------
local gui = Instance.new("ScreenGui")
gui.Name = "Grind1520"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = o
end

local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local function text(parent, props)
	local t = new("TextLabel", {
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBold,
		TextColor3 = WHITE,
		TextScaled = false,
		TextSize = 18,
		TextWrapped = true,
	}, parent)
	for k, v in pairs(props) do
		t[k] = v
	end
	return t
end

local function button(parent, props)
	local b = new("TextButton", {
		AutoButtonColor = true,
		Font = Enum.Font.GothamBold,
		TextSize = 18,
		TextColor3 = WHITE,
		BackgroundColor3 = Color3.fromRGB(34, 52, 86),
		TextWrapped = true,
	}, parent)
	for k, v in pairs(props) do
		b[k] = v
	end
	corner(b, 10)
	return b
end

-- ---------- HUD ----------
local hud = new("Frame", { Size = UDim2.fromOffset(260, 84), Position = UDim2.fromOffset(12, 12), BackgroundColor3 = NAVY, BackgroundTransparency = 0.15 }, gui)
corner(hud, 14)
local coinText = text(hud, { Size = UDim2.new(1, -20, 0, 36), Position = UDim2.fromOffset(12, 6), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 28, TextColor3 = GOLD, Font = Enum.Font.GothamBlack, Text = "0" })
local subText = text(hud, { Size = UDim2.new(1, -20, 0, 36), Position = UDim2.fromOffset(12, 42), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 15, TextColor3 = Color3.fromRGB(180, 195, 220), Text = "" })

local dock = new("Frame", { Size = UDim2.fromOffset(420, 52), Position = UDim2.new(0.5, -210, 1, -64), BackgroundTransparency = 1 }, gui)
new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center }, dock)
local qBtn = button(dock, { Size = UDim2.fromOffset(160, 52), Text = "📝 Questions (Q)", BackgroundColor3 = Color3.fromRGB(20, 110, 140) })
local bBtn = button(dock, { Size = UDim2.fromOffset(120, 52), Text = "🏗 Build (B)", BackgroundColor3 = Color3.fromRGB(30, 120, 80) })
local uBtn = button(dock, { Size = UDim2.fromOffset(120, 52), Text = "⚡ Shop (U)", BackgroundColor3 = Color3.fromRGB(140, 100, 20) })

-- Floating "+coins" popups over the HUD.
local function popup(msg, color)
	local t = text(gui, { Size = UDim2.fromOffset(300, 40), Position = UDim2.new(0.5, -150, 0.35, 0), TextSize = 30, Font = Enum.Font.GothamBlack, TextColor3 = color, Text = msg, TextStrokeTransparency = 0.4 })
	TweenService:Create(t, TweenInfo.new(1.1), { Position = UDim2.new(0.5, -150, 0.25, 0), TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1.2, function() t:Destroy() end)
end

-- ---------- panels ----------
local panels = {}
local function makePanel(name, title)
	local f = new("Frame", { Name = name, Size = UDim2.new(0, 560, 0, 440), Position = UDim2.new(0.5, -280, 0.5, -230), BackgroundColor3 = PANEL, Visible = false }, gui)
	corner(f, 16)
	new("UIStroke", { Color = Color3.fromRGB(60, 90, 140), Thickness = 2 }, f)
	new("UISizeConstraint", { MaxSize = Vector2.new(560, 440) }, f)
	text(f, { Size = UDim2.new(1, -60, 0, 40), Position = UDim2.fromOffset(18, 10), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 24, Font = Enum.Font.GothamBlack, Text = title })
	local x = button(f, { Size = UDim2.fromOffset(36, 36), Position = UDim2.new(1, -46, 0, 10), Text = "✕", BackgroundColor3 = Color3.fromRGB(60, 40, 50) })
	x.MouseButton1Click:Connect(function() f.Visible = false end)
	panels[name] = f
	return f
end

-- Questions
local qp = makePanel("questions", "Answer to earn")
local meta = text(qp, { Size = UDim2.new(1, -36, 0, 20), Position = UDim2.fromOffset(18, 50), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 14, TextColor3 = CYAN, Text = "" })
local qText = text(qp, { Size = UDim2.new(1, -36, 0, 96), Position = UDim2.fromOffset(18, 74), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextSize = 20, Text = "" })
local choiceBtns = {}
for i = 1, 4 do
	local b = button(qp, { Size = UDim2.new(0.5, -24, 0, 70), Position = UDim2.new((i - 1) % 2 * 0.5, 18 - ((i - 1) % 2) * 6, 0, 176 + math.floor((i - 1) / 2) * 80), Text = "", TextSize = 17 })
	choiceBtns[i] = b
end
local result = text(qp, { Size = UDim2.new(1, -36, 0, 40), Position = UDim2.new(0, 18, 1, -56), TextSize = 22, Font = Enum.Font.GothamBlack, Text = "" })

local busy = false
local function loadQuestion()
	result.Text = ""
	for _, b in ipairs(choiceBtns) do
		b.BackgroundColor3 = Color3.fromRGB(34, 52, 86)
		b.Text = "…"
	end
	local q = GetQuestion:InvokeServer()
	if not q then return end
	meta.Text = q.domain .. " · " .. q.skill
	qText.Text = q.q
	for i, b in ipairs(choiceBtns) do
		b.Text = string.char(64 + i) .. ")  " .. (q.choices[i] or "")
	end
	busy = false
end

local function answer(i)
	if busy then return end
	busy = true
	local r = SubmitAnswer:InvokeServer(i)
	if not r then busy = false return end
	choiceBtns[r.answer].BackgroundColor3 = GREEN
	if r.right then
		result.TextColor3 = GREEN
		result.Text = "Right! +" .. Config.format(r.pay) .. " coins" .. (r.streak >= 3 and ("  ·  streak " .. r.streak) or "")
		popup("+" .. Config.format(r.pay), GOLD)
	else
		choiceBtns[i].BackgroundColor3 = RED
		result.TextColor3 = RED
		result.Text = "Not quite. The right answer is highlighted."
	end
	task.wait(r.right and 0.9 or 2)
	if qp.Visible then loadQuestion() else busy = false end
end
for i, b in ipairs(choiceBtns) do
	b.MouseButton1Click:Connect(function() answer(i) end)
end

-- A list panel for the shop and the builder.
local function listPanel(name, title)
	local f = makePanel(name, title)
	local sc = new("ScrollingFrame", { Size = UDim2.new(1, -24, 1, -64), Position = UDim2.fromOffset(12, 56), BackgroundTransparency = 1, ScrollBarThickness = 6, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new() }, f)
	new("UIListLayout", { Padding = UDim.new(0, 8) }, sc)
	return sc
end

local shopList = listPanel("shop", "Upgrade shop")
local buildList = listPanel("build", "Build your city")
local rows = {}

local function row(parent, key, title, desc, onBuy)
	local r = new("Frame", { Size = UDim2.new(1, -8, 0, 64), BackgroundColor3 = Color3.fromRGB(24, 40, 70) }, parent)
	corner(r, 10)
	local t = text(r, { Size = UDim2.new(1, -170, 0, 26), Position = UDim2.fromOffset(12, 6), TextXAlignment = Enum.TextXAlignment.Left, Text = title })
	local d = text(r, { Size = UDim2.new(1, -170, 0, 26), Position = UDim2.fromOffset(12, 32), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 14, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(180, 195, 220), Text = desc })
	local b = button(r, { Size = UDim2.fromOffset(140, 44), Position = UDim2.new(1, -150, 0, 10), Text = "", TextColor3 = Color3.fromRGB(28, 20, 0) })
	b.MouseButton1Click:Connect(onBuy)
	rows[key] = { title = t, desc = d, btn = b }
end

for _, u in ipairs(Config.Upgrades) do
	row(shopList, "u:" .. u.id, u.name, u.desc, function()
		Buy:InvokeServer("upgrade", u.id)
	end)
end
for _, B in ipairs(Config.Buildings) do
	row(buildList, "b:" .. B.id, B.name, B.domain .. " · +" .. Config.format(B.income) .. "/s each", function()
		if Buy:InvokeServer("building", B.id) then popup("Built " .. B.name .. "!", GREEN) end
	end)
end

local function refresh()
	coinText.Text = "🪙 " .. Config.format(S.coins)
	subText.Text = "+" .. Config.format(S.income) .. "/s  ·  streak " .. S.streak .. "  ·  " .. S.correct .. " right"
	for _, u in ipairs(Config.Upgrades) do
		local r = rows["u:" .. u.id]
		local lv = S.up[u.id] or 0
		r.title.Text = u.name .. "  (Lv " .. lv .. "/" .. u.max .. ")"
		if lv >= u.max then
			r.btn.Text = "MAX"
			r.btn.BackgroundColor3 = Color3.fromRGB(50, 60, 80)
		else
			local cost = Config.upgradeCost(u, lv)
			r.btn.Text = "🪙 " .. Config.format(cost)
			r.btn.BackgroundColor3 = S.coins >= cost and GOLD or Color3.fromRGB(90, 80, 50)
		end
	end
	for _, B in ipairs(Config.Buildings) do
		local r = rows["b:" .. B.id]
		local n = S.b[B.id] or 0
		local cost = math.floor(B.cost * 1.15 ^ n)
		r.title.Text = B.name .. "  ×" .. n
		r.btn.Text = "🪙 " .. Config.format(cost)
		r.btn.BackgroundColor3 = S.coins >= cost and GOLD or Color3.fromRGB(90, 80, 50)
	end
end

State.OnClientEvent:Connect(function(s)
	S = s
	refresh()
end)

local function toggle(name)
	for n, f in pairs(panels) do
		if n ~= name then f.Visible = false end
	end
	local f = panels[name]
	f.Visible = not f.Visible
	if name == "questions" and f.Visible then task.spawn(loadQuestion) end
end
Open.OnClientEvent:Connect(function(name)
	if not panels[name].Visible then toggle(name) end
end)
qBtn.MouseButton1Click:Connect(function() toggle("questions") end)
bBtn.MouseButton1Click:Connect(function() toggle("build") end)
uBtn.MouseButton1Click:Connect(function() toggle("shop") end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	local k = input.KeyCode
	if k == Enum.KeyCode.Q then toggle("questions")
	elseif k == Enum.KeyCode.B then toggle("build")
	elseif k == Enum.KeyCode.U then toggle("shop")
	elseif qp.Visible and (k == Enum.KeyCode.One or k == Enum.KeyCode.Two or k == Enum.KeyCode.Three or k == Enum.KeyCode.Four) then
		answer(({ [Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2, [Enum.KeyCode.Three] = 3, [Enum.KeyCode.Four] = 4 })[k])
	end
end)

refresh()
