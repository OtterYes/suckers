-- PSAT-style questions. Math ones are generated with fresh numbers every time;
-- Reading and Writing ones are written out. The server picks and grades them.
local Questions = {}

local rng = Random.new()

local function shuffle(choices, correct)
	local items = {}
	for i, c in ipairs(choices) do
		items[i] = { text = c, right = (i == correct) }
	end
	for i = #items, 2, -1 do
		local j = rng:NextInteger(1, i)
		items[i], items[j] = items[j], items[i]
	end
	local out, answer = {}, 1
	for i, it in ipairs(items) do
		out[i] = it.text
		if it.right then answer = i end
	end
	return out, answer
end

-- Three wrong answers near the right one, all different.
local function near(ans, spread)
	local set = { [ans] = true }
	local list = {}
	while #list < 3 do
		local d = rng:NextInteger(-spread, spread)
		local v = ans + d
		if not set[v] then
			set[v] = true
			table.insert(list, v)
		end
	end
	return list
end

local function numeric(q, ans, spread, domain, skill)
	local wrong = near(ans, spread)
	local choices, answer = shuffle({ tostring(ans), tostring(wrong[1]), tostring(wrong[2]), tostring(wrong[3]) }, 1)
	return { q = q, choices = choices, answer = answer, domain = domain, skill = skill }
end

local generators = {
	function()
		local x = rng:NextInteger(-9, 12)
		local a = rng:NextInteger(2, 9)
		local b = rng:NextInteger(-20, 20)
		local c = a * x + b
		return numeric(string.format("If %dx + %d = %d, what is the value of x?", a, b, c), x, 5, "Algebra", "Linear equations in one variable")
	end,
	function()
		local x1, y1 = rng:NextInteger(-5, 5), rng:NextInteger(-5, 5)
		local m = rng:NextInteger(-4, 5)
		if m == 0 then m = 2 end
		local dx = rng:NextInteger(1, 6)
		local x2, y2 = x1 + dx, y1 + m * dx
		return numeric(string.format("What is the slope of the line through (%d, %d) and (%d, %d)?", x1, y1, x2, y2), m, 4, "Algebra", "Linear functions")
	end,
	function()
		local x, y = rng:NextInteger(-6, 8), rng:NextInteger(-6, 8)
		local s, d = x + y, x - y
		return numeric(string.format("x + y = %d and x - y = %d. What is the value of x?", s, d), x, 4, "Algebra", "Systems of two linear equations")
	end,
	function()
		local p = ({ 10, 15, 20, 25, 30, 40, 60, 75 })[rng:NextInteger(1, 8)]
		local whole = rng:NextInteger(2, 20) * 20
		local ans = whole * p // 100
		return numeric(string.format("What is %d%% of %d?", p, whole), ans, math.max(5, ans // 4), "Problem-Solving & Data", "Percentages")
	end,
	function()
		local triples = { { 3, 4, 5 }, { 5, 12, 13 }, { 8, 15, 17 }, { 6, 8, 10 }, { 9, 12, 15 }, { 7, 24, 25 } }
		local t = triples[rng:NextInteger(1, #triples)]
		return numeric(string.format("A right triangle has legs %d and %d. How long is the hypotenuse?", t[1], t[2]), t[3], 4, "Geometry & Trig", "Right triangles and trigonometry")
	end,
	function()
		local r1, r2 = rng:NextInteger(-7, 7), rng:NextInteger(-7, 7)
		local b, c = -(r1 + r2), r1 * r2
		return numeric(string.format("x² %s %dx %s %d = 0. What is the sum of the solutions?", b < 0 and "-" or "+", math.abs(b), c < 0 and "-" or "+", math.abs(c)), r1 + r2, 5, "Advanced Math", "Nonlinear equations")
	end,
	function()
		local n = {}
		local sum = 0
		local mean = rng:NextInteger(5, 30)
		for i = 1, 4 do
			local v = mean + rng:NextInteger(-6, 6)
			n[i] = v
			sum += v
		end
		n[5] = mean * 5 - sum
		return numeric(string.format("What is the mean of %d, %d, %d, %d, and %d?", n[1], n[2], n[3], n[4], n[5]), mean, 4, "Problem-Solving & Data", "One-variable data")
	end,
	function()
		local a, b = rng:NextInteger(2, 6), rng:NextInteger(1, 9)
		local x = rng:NextInteger(-4, 5)
		return numeric(string.format("f(x) = %dx² - %d. What is f(%d)?", a, b, x), a * x * x - b, 8, "Advanced Math", "Nonlinear functions")
	end,
}

local written = {
	{ q = "The committee rejected the plan, _____ it would cost too much to maintain.", choices = { "arguing that", "however", "for example,", "in contrast," }, domain = "Expression of Ideas", skill = "Transitions" },
	{ q = "Most scientists once thought the planet was lifeless. _____, recent missions have found signs of water.", choices = { "However", "Therefore", "Similarly", "For instance" }, domain = "Expression of Ideas", skill = "Transitions" },
	{ q = "Which choice is punctuated correctly?", choices = { "The team won; the crowd cheered.", "The team won, the crowd cheered.", "The team won the crowd cheered.", "The team, won; the crowd cheered." }, domain = "Conventions", skill = "Boundaries" },
	{ q = "Which choice is correct? Neither of the reports _____ the new data.", choices = { "includes", "include", "are including", "have included" }, domain = "Conventions", skill = "Form, Structure, and Sense" },
	{ q = "The critic called the novel's plot \"labyrinthine,\" meaning it was _____.", choices = { "complicated and hard to follow", "short and simple", "funny", "based on history" }, domain = "Craft & Structure", skill = "Words in Context" },
	{ q = "A text says bees that find food dance to show others where it is. Which finding supports that?", choices = { "Bees that watch a dance fly straight to the food", "Bees can see some colors", "Hives hold thousands of bees", "Bees live about six weeks" }, domain = "Information & Ideas", skill = "Command of Evidence: Textual" },
	{ q = "The author mentions an old theory mainly to _____.", choices = { "set up a contrast with newer evidence", "prove the theory is still correct", "describe the author's childhood", "list every scientist involved" }, domain = "Craft & Structure", skill = "Text Structure and Purpose" },
	{ q = "Researchers found fewer birds in noisy parks than quiet ones. What can most reasonably be inferred?", choices = { "Noise may keep some birds away", "Birds prefer cities", "All parks are noisy", "Noise helps birds find food" }, domain = "Information & Ideas", skill = "Inferences" },
}

function Questions.next()
	if rng:NextNumber() < 0.65 then
		return generators[rng:NextInteger(1, #generators)]()
	end
	local w = written[rng:NextInteger(1, #written)]
	local choices, answer = shuffle(w.choices, 1)
	return { q = w.q, choices = choices, answer = answer, domain = w.domain, skill = w.skill }
end

return Questions
