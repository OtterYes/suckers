-- Prices and payouts. Every number that shapes the economy lives here.
local Config = {}

Config.Upgrades = {
	{ id = "value", name = "Answer Value", desc = "More coins per right answer.", base = 50, growth = 2.2, max = 10 },
	{ id = "mult", name = "Multiplier", desc = "Multiplies every coin you earn.", base = 200, growth = 2.6, max = 10 },
	{ id = "streak", name = "Streak Bonus", desc = "Each answer in a row adds more.", base = 120, growth = 2.4, max = 10 },
	{ id = "shield", name = "Streak Shield", desc = "A wrong answer halves your streak instead of ending it.", base = 1500, growth = 1, max = 1 },
}

-- One building per PSAT domain. Income is coins per second, forever.
Config.Buildings = {
	{ id = "library", name = "Library", domain = "Information & Ideas", cost = 100, income = 1, color = Color3.fromRGB(92, 157, 255), height = 10 },
	{ id = "bookshop", name = "Bookshop", domain = "Craft & Structure", cost = 400, income = 3, color = Color3.fromRGB(157, 124, 255), height = 12 },
	{ id = "transit", name = "Transit Station", domain = "Expression of Ideas", cost = 1500, income = 8, color = Color3.fromRGB(47, 221, 185), height = 14 },
	{ id = "clock", name = "Clock Tower", domain = "Conventions", cost = 5000, income = 20, color = Color3.fromRGB(229, 123, 255), height = 30 },
	{ id = "factory", name = "Scale Works", domain = "Algebra", cost = 15000, income = 50, color = Color3.fromRGB(255, 154, 61), height = 16 },
	{ id = "lab", name = "Laboratory", domain = "Advanced Math", cost = 50000, income = 140, color = Color3.fromRGB(255, 107, 139), height = 22 },
	{ id = "bank", name = "Bank", domain = "Problem-Solving & Data", cost = 150000, income = 380, color = Color3.fromRGB(210, 238, 85), height = 26 },
	{ id = "lighthouse", name = "Lighthouse", domain = "Geometry & Trig", cost = 500000, income = 1000, color = Color3.fromRGB(91, 227, 125), height = 45 },
}

function Config.upgradeCost(u, level)
	return math.floor(u.base * u.growth ^ level)
end

-- Coins for one right answer, given upgrade levels and the current streak.
function Config.answerPay(up, streak)
	local base = 10 + 15 * (up.value or 0)
	local mult = 1 + 0.5 * (up.mult or 0)
	local streakBonus = 1 + math.min(streak, 20) * (0.02 + 0.03 * (up.streak or 0))
	return math.floor(base * mult * streakBonus)
end

function Config.format(n)
	n = math.floor(n)
	if n < 1000 then return tostring(n) end
	local units = { "K", "M", "B", "T" }
	local i = 0
	local v = n
	while v >= 1000 and i < #units do
		v = v / 1000
		i += 1
	end
	return string.format(v >= 100 and "%.0f%s" or "%.1f%s", v, units[i])
end

return Config
