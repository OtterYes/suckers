-- Grind to 1520 on Roblox: the server grades answers, pays coins, saves progress,
-- and builds the shared world. Every player gets a plot; right answers grow it.
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Questions = require(Shared:WaitForChild("Questions"))

local store = nil
pcall(function()
	store = DataStoreService:GetDataStore("Grind1520_v1")
end)

-- ---------- remotes ----------
local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage
local function remote(class, name)
	local r = Instance.new(class)
	r.Name = name
	r.Parent = remotes
	return r
end
local GetQuestion = remote("RemoteFunction", "GetQuestion")
local SubmitAnswer = remote("RemoteFunction", "SubmitAnswer")
local Buy = remote("RemoteFunction", "Buy")
local State = remote("RemoteEvent", "State") -- server -> client: your data changed
local Open = remote("RemoteEvent", "Open") -- server -> client: open a panel (a kiosk was used)

-- ---------- the world ----------
local world = Instance.new("Folder")
world.Name = "City"
world.Parent = workspace

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(props) do
		p[k] = v
	end
	p.Parent = props.Parent or world
	return p
end

local function label(parent, text, color, offset)
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.fromOffset(240, 60)
	g.StudsOffset = offset or Vector3.new(0, 4, 0)
	g.AlwaysOnTop = false
	g.MaxDistance = 150
	g.Parent = parent
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.TextColor3 = color or Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0.3
	t.Text = text
	t.Parent = g
	return t
end

-- Ground and plaza
part({ Name = "Ground", Size = Vector3.new(700, 2, 700), Position = Vector3.new(0, -1, 0), Color = Color3.fromRGB(110, 160, 90), Material = Enum.Material.Grass })
part({ Name = "Plaza", Size = Vector3.new(90, 0.4, 90), Position = Vector3.new(0, 0.2, 0), Color = Color3.fromRGB(205, 198, 182), Material = Enum.Material.Slate })
local spawn = Instance.new("SpawnLocation")
spawn.Anchored = true
spawn.Size = Vector3.new(10, 1, 10)
spawn.Position = Vector3.new(0, 0.5, 30)
spawn.Color = Color3.fromRGB(255, 201, 51)
spawn.Neutral = true
spawn.Parent = world

-- The 1520 Tower in the middle: it rises with everyone's right answers today.
local tower = part({ Name = "Tower1520", Size = Vector3.new(10, 20, 10), Position = Vector3.new(0, 10, 0), Color = Color3.fromRGB(60, 80, 120), Material = Enum.Material.Glass })
local towerLabel = label(tower, "1520 TOWER", Color3.fromRGB(255, 201, 51), Vector3.new(0, 14, 0))
local cityCorrect = 0
local function growTower()
	local h = 20 + math.min(200, cityCorrect * 0.5)
	tower.Size = Vector3.new(10, h, 10)
	tower.Position = Vector3.new(0, h / 2, 0)
	towerLabel.Text = "1520 TOWER · " .. cityCorrect .. " right today"
end

-- Kiosks: walk up and press E. Study stations open questions; the shop opens upgrades.
local function kiosk(name, pos, color, action, panel)
	local k = part({ Name = name, Size = Vector3.new(6, 7, 3), Position = pos, Color = color, Material = Enum.Material.Neon })
	label(k, name, Color3.new(1, 1, 1), Vector3.new(0, 6, 0))
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = action
	prompt.ObjectText = name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.Parent = k
	prompt.Triggered:Connect(function(player)
		Open:FireClient(player, panel)
	end)
end
for i = 0, 3 do
	local a = i * math.pi / 2 + math.pi / 4
	kiosk("Study Station", Vector3.new(math.cos(a) * 28, 3.5, math.sin(a) * 28), Color3.fromRGB(63, 216, 255), "Answer questions", "questions")
end
kiosk("Upgrade Shop", Vector3.new(-14, 3.5, 20), Color3.fromRGB(255, 201, 51), "Shop", "shop")
kiosk("Builder", Vector3.new(14, 3.5, 20), Color3.fromRGB(91, 227, 125), "Build", "build")

-- Plots: six around the plaza, one per player. Buildings stand on pads in each plot.
local PLOTS = 6
local plots = {}
for i = 1, PLOTS do
	local a = (i - 1) / PLOTS * math.pi * 2
	local center = Vector3.new(math.cos(a) * 130, 0, math.sin(a) * 130)
	local base = part({ Name = "Plot" .. i, Size = Vector3.new(80, 0.6, 80), Position = center + Vector3.new(0, 0.3, 0), Color = Color3.fromRGB(150, 155, 165), Material = Enum.Material.Concrete })
	base.CFrame = CFrame.lookAt(base.Position, Vector3.new(0, 0.3, 0))
	local sign = part({ Name = "Sign", Size = Vector3.new(14, 4, 1), Color = Color3.fromRGB(31, 107, 74) })
	sign.CFrame = base.CFrame * CFrame.new(0, 3, -44)
	local owner = label(sign, "Empty lot", Color3.new(1, 1, 1), Vector3.new(0, 3, 0))
	plots[i] = { base = base, sign = owner, player = nil, models = {} }
end

-- Pad i sits in a 4 x 2 grid on the plot, in the order of Config.Buildings.
local function padCFrame(plot, i)
	local col = (i - 1) % 4
	local row = math.floor((i - 1) / 4)
	return plot.base.CFrame * CFrame.new(-27 + col * 18, 0.3, -12 + row * 26)
end

local function drawBuilding(plot, i, count)
	local old = plot.models[i]
	if old then old:Destroy() end
	plot.models[i] = nil
	local B = Config.Buildings[i]
	local m = Instance.new("Model")
	m.Name = B.id
	local cf = padCFrame(plot, i)
	if count <= 0 then
		local ghost = part({ Name = "Lot", Size = Vector3.new(14, 0.3, 14), Color = B.color, Transparency = 0.6, Parent = m })
		ghost.CFrame = cf * CFrame.new(0, 0.2, 0)
		label(ghost, B.name .. " · " .. Config.format(B.cost), B.color, Vector3.new(0, 3, 0))
	else
		-- Taller with every copy you own, up to three times the base height.
		local h = B.height * math.min(3, 1 + (count - 1) * 0.15)
		local body = part({ Name = "Body", Size = Vector3.new(12, h, 12), Color = B.color, Material = Enum.Material.SmoothPlastic, Parent = m })
		body.CFrame = cf * CFrame.new(0, h / 2, 0)
		local roof = part({ Name = "Roof", Size = Vector3.new(13, 1, 13), Color = Color3.fromRGB(60, 70, 90), Parent = m })
		roof.CFrame = cf * CFrame.new(0, h + 0.5, 0)
		for y = 3, h - 2, 4 do
			local win = part({ Name = "Windows", Size = Vector3.new(12.2, 1.4, 12.2), Color = Color3.fromRGB(255, 225, 150), Material = Enum.Material.Neon, Transparency = 0.35, Parent = m })
			win.CFrame = cf * CFrame.new(0, y, 0)
		end
		label(roof, B.name .. " ×" .. count, Color3.new(1, 1, 1), Vector3.new(0, 4, 0))
	end
	m.Parent = world
	plot.models[i] = m
end

-- ---------- player data ----------
local data = {}
local pending = {}

local function fresh()
	return { coins = 0, life = 0, correct = 0, answered = 0, streak = 0, best = 0, up = {}, b = {} }
end

local function income(d)
	local s = 0
	for i, B in ipairs(Config.Buildings) do
		s += B.income * (d.b[B.id] or 0)
	end
	return s * (1 + 0.5 * (d.up.mult or 0))
end

local function push(player)
	local d = data[player]
	if not d then return end
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		ls.Coins.Value = math.floor(d.coins)
		ls.Correct.Value = d.correct
	end
	State:FireClient(player, { coins = d.coins, correct = d.correct, answered = d.answered, streak = d.streak, best = d.best, up = d.up, b = d.b, income = income(d) })
end

local function plotOf(player)
	for _, p in ipairs(plots) do
		if p.player == player then return p end
	end
	return nil
end

local function drawPlot(player)
	local p = plotOf(player)
	local d = data[player]
	if not p or not d then return end
	for i, B in ipairs(Config.Buildings) do
		drawBuilding(p, i, d.b[B.id] or 0)
	end
end

local function save(player)
	local d = data[player]
	if not d or not store then return end
	pcall(function()
		store:SetAsync("u" .. player.UserId, d)
	end)
end

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local c = Instance.new("IntValue")
	c.Name = "Coins"
	c.Parent = ls
	local r = Instance.new("IntValue")
	r.Name = "Correct"
	r.Parent = ls

	local d = fresh()
	if store then
		local ok, saved = pcall(function()
			return store:GetAsync("u" .. player.UserId)
		end)
		if ok and type(saved) == "table" then
			for k, v in pairs(saved) do
				d[k] = v
			end
		end
	end
	d.streak = 0
	data[player] = d

	for _, p in ipairs(plots) do
		if not p.player then
			p.player = player
			p.sign.Text = player.DisplayName .. "'s City"
			break
		end
	end
	drawPlot(player)
	push(player)
end)

Players.PlayerRemoving:Connect(function(player)
	save(player)
	local p = plotOf(player)
	if p then
		p.player = nil
		p.sign.Text = "Empty lot"
		for i, m in pairs(p.models) do
			m:Destroy()
			p.models[i] = nil
		end
	end
	data[player] = nil
	pending[player] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		save(player)
	end
end)

-- ---------- questions ----------
GetQuestion.OnServerInvoke = function(player)
	local q = Questions.next()
	pending[player] = { answer = q.answer, t = os.clock() }
	return { q = q.q, choices = q.choices, domain = q.domain, skill = q.skill }
end

SubmitAnswer.OnServerInvoke = function(player, choice)
	local d, p = data[player], pending[player]
	if not d or not p or type(choice) ~= "number" then return nil end
	pending[player] = nil
	d.answered += 1
	local right = choice == p.answer
	local pay = 0
	if right then
		d.streak += 1
		d.best = math.max(d.best, d.streak)
		d.correct += 1
		pay = Config.answerPay(d.up, d.streak)
		d.coins += pay
		d.life += pay
		cityCorrect += 1
		growTower()
	else
		d.streak = (d.up.shield or 0) > 0 and math.floor(d.streak / 2) or 0
	end
	push(player)
	return { right = right, answer = p.answer, pay = pay, streak = d.streak }
end

-- ---------- buying ----------
Buy.OnServerInvoke = function(player, kind, id)
	local d = data[player]
	if not d then return false end
	if kind == "upgrade" then
		for _, u in ipairs(Config.Upgrades) do
			if u.id == id then
				local lv = d.up[id] or 0
				if lv >= u.max then return false end
				local cost = Config.upgradeCost(u, lv)
				if d.coins < cost then return false end
				d.coins -= cost
				d.up[id] = lv + 1
				push(player)
				return true
			end
		end
	elseif kind == "building" then
		for i, B in ipairs(Config.Buildings) do
			if B.id == id then
				local n = d.b[id] or 0
				local cost = math.floor(B.cost * 1.15 ^ n)
				if d.coins < cost then return false end
				d.coins -= cost
				d.b[id] = n + 1
				local p = plotOf(player)
				if p then drawBuilding(p, i, n + 1) end
				push(player)
				return true
			end
		end
	end
	return false
end

-- ---------- income every second, saves every minute ----------
local acc, saveAcc = 0, 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	saveAcc += dt
	if acc >= 1 then
		acc -= 1
		for player, d in pairs(data) do
			local inc = income(d)
			if inc > 0 then
				d.coins += inc
				d.life += inc
				push(player)
			end
		end
	end
	if saveAcc >= 60 then
		saveAcc = 0
		for player in pairs(data) do
			task.spawn(save, player)
		end
	end
end)

growTower()
