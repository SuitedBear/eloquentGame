
let simpleLevelPlan = `
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`;

class Level {
	constructor(plan) {
		let rows = plan.trim().split("\n").map(l => [...l]);
		this.height = rows.length;
		this.width = rows[0].length;
		this.startActors = [];

		this.rows = rows.map((row, y) => {
			return row.map((ch, x) => {
				let type = levelChars[ch];
				if (typeof type == "string") return type;
				this.startActors.push(type.create(new Vec(x, y), ch));
				return "empty";
			});
		});
	}
}

class State {
	constructor(Level, actors, status, lives) {
		this.level = Level;
		this.actors = actors;
		this.status = status;
		this.lives = lives
	}

	static start(level) {
		return new State(level, level.startActors, "playing", 3);
	}

	get player() {
		return this.actors.find(a => a.type == "player");
	}
}

class Vec {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	plus(other) {
		return new Vec(this.x + other.x, this.y + other.y);
	}

	times(factor) {
		return new Vec(this.x * factor, this.y * factor);
	}
}

class Player {
	constructor(pos, speed) {
		this.pos = pos;
		this.speed = speed;
	}

	get type() { return "player"; }

	static create(pos) {
		return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
	}
}

Player.prototype.size = new Vec(0.8, 1.5);

class Lava {
	constructor(pos, speed, reset) {
		this.pos = pos;
		this.speed = speed;
		this.reset = reset;
	}

	get type() { return "lava"; }

	static create(pos, ch) {
		if (ch == "=") {
			return new Lava(pos, new Vec(2, 0));
		} else if (ch == "|") {
			return new Lava(pos, new Vec(0, 2));
		} else if (ch == "v") {
			return new Lava(pos, new Vec(0, 3), pos);
		}
	}
}

Lava.prototype.size = new Vec(1, 1);

class Coin {
	constructor(pos, basePos, wobble) {
		this.pos = pos;
		this.basePos = basePos;
		this.wobble = wobble;
	}

	get type() { return "coin"; }

	static create(pos) {
		let basePos = pos.plus(new Vec(0.2, 0.1));
		return new Coin(basePos, basePos, Math.random() * Math.PI * 2);
	}
}

Coin.prototype.size = new Vec(0.6, 0.6);

class Monster {
  	constructor(pos, speed) {
  		this.pos = pos;
  		this.speed = speed;
  	}

  	get type() { return "monster"; }

	static create(pos) {
		return new Monster(pos.plus(new Vec(0, -1)), new Vec(-1, 0));
	}

	update(time, state) {
		let newPos = this.pos.plus(this.speed.times(time));
		if (!state.level.touches(newPos, this.size, "wall")) {
			return new Monster(newPos, this.speed);	
		} else {
			return new Monster(this.pos, this.speed.times(-1));
		}
	}

  	collide(state) {
  		if (this.pos.y + 1 > state.player.pos.y + state.player.size.y) {
  			let filtered = state.actors.filter(a => a != this);
  			return new State(state.level, filtered, state.status, this.lives);
  		} else {
  			return new State(state.level, state.actors, "lost", this.lives - 1);
  		}
  	}
}

Monster.prototype.size = new Vec(1.2, 2);

const levelChars = {
	".": "empty", "#": "wall",
	"+": "lava",
	"@": Player, "o": Coin,
	"=": Lava, "|": Lava, "v": Lava,
	"M": Monster
}

// let simpleLevel = new Level(simpleLevelPlan);
// let display = new DOMDisplay(document.body, simpleLevel);
// display.syncState(State.start(simpleLevel));

Level.prototype.touches = function(pos, size, type) {
	var xStart = Math.floor(pos.x);
	var xEnd = Math.ceil(pos.x + size.x);
	var yStart = Math.floor(pos.y);
	var yEnd = Math.ceil(pos.y + size.y);

	for (var y = yStart; y < yEnd; y++) {
		for (var x = xStart; x < xEnd; x++) {
			let isOutside = x < 0 || x >= this.width ||
				y < 0 || y >= this.height;
			let here = isOutside ? "wall" : this.rows[y][x];
			if (here == type) return true;
		}
	}
	return false;
}

State.prototype.update = function(time, keys) {
	let actors = this.actors.map(actor => actor.update(time, this, keys));
	let newState = new State(this.level, actors, this.status, this.lives);

	if(newState.status != "playing") return newState;

	let player = newState.player;
	if (this.level.touches(player.pos, player.size, "lava")) {
		return new State(this.level, actors, "lost", this.lives - 1);
	}

	for (let actor of actors) {
		if (actor != player && overlap(actor, player)) {
			newState = actor.collide(newState);
		}
	}
	return newState;
};

function overlap(actor1, actor2) {
	return actor1.pos.x + actor1.size.x > actor2.pos.x &&
		actor1.pos.x < actor2.pos.x + actor2.size.x &&
		actor1.pos.y + actor1.size.y > actor2.pos.y &&
		actor1.pos.y < actor2.pos.y + actor2.size.y;
}

Lava.prototype.collide = function(state) {
	return new State(state.level, state.actors, "lost", this.lives - 1);
};

Coin.prototype.collide = function(state) {
	let filtered = state.actors.filter(a => a != this);
	let status = state.status;
	if (!filtered.some(a => a.type == "coin")) status = "won";
	return new State(state.level, filtered, status, this.lives);
};

Lava.prototype.update = function(time, state) {
	let newPos = this.pos.plus(this.speed.times(time));
	if (!state.level.touches(newPos, this.size, "wall")) {
		return new Lava(newPos, this.speed, this.reset);
	} else if (this.reset) {
		return new Lava(this.reset, this.speed, this.reset);
	} else {
		return new Lava(this.pos, this.speed.times(-1));
	}
};

const wobbleSpeed = 8, wobbleDist = 0.07;

Coin.prototype.update = function(time) {
	let wobble = this.wobble + time * wobbleSpeed;
	let wobblePos = Math.sin(wobble) * wobbleDist;
	return new Coin(this.basePos.plus(new Vec(0, wobblePos)), 
		this.basePos, wobble);
};

const playerXSpeed = 7;
const gravity = 30;
const jumpSpeed = 17;

Player.prototype.update = function(time, state, keys) {
	let xSpeed = 0;
	if (keys.ArrowLeft) xSpeed -= playerXSpeed;
	if (keys.ArrowRight) xSpeed += playerXSpeed;
	let pos = this.pos;
	let movedX = pos.plus(new Vec(xSpeed * time, 0));
	if (!state.level.touches(movedX, this.size, "wall")) {
		pos = movedX;
	}

	let ySpeed = this.speed.y + time * gravity;
	let movedY = pos.plus(new Vec(0, ySpeed * time));
	if (!state.level.touches(movedY, this.size, "wall")) {
		pos = movedY;
	} else if (keys.ArrowUp && ySpeed > 0) {
		ySpeed = -jumpSpeed;
	} else {
		ySpeed = 0;
	}
	return new Player(pos, new Vec(xSpeed, ySpeed));
};

function trackKeys(keys, unreg=false) {
	if (unreg) {
		window.removeEventListener("keydown", track);
		window.removeEventListener("keyup", track);
		console.log("key listeners unregistered");
		return null;
	}
	let down = Object.create(null);
	function track(event) {
		if (keys.includes(event.key)) {
			down[event.key] = event.type == "keydown";
			event.preventDefault();
		}
	}
	window.addEventListener("keydown", track);
	window.addEventListener("keyup", track);
	return down;
}

//const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);

function runAnimation(frameFunc) {
	let lastTime = null;
	function frame(time) {
		if (lastTime != null) {
			let timeStep = Math.min(time - lastTime, 100) / 1000;
			if (frameFunc(timeStep) === false) return;
		}
		lastTime = time;
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

function runLevel(level, Display) {
	let display = new Display(document.body, level);
	let state = State.start(level);
	let ending = 0.2;
	let pause = false;
	let arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);
	window.addEventListener("keyup", event => {
		if (event.key == "Escape") {
			pause = !pause;
			event.preventDefault();
		}
		
	});
	return new Promise(resolve => {
		runAnimation(time => {
			if (!pause) {
				state = state.update(time, arrowKeys);
				display.syncState(state);
				if (state.status == "playing") {
					return true;
				} else if (ending > 0) {
					ending -= time;
					return true;
				} else {
					display.clear();
					resolve(state.status);
					trackKeys([], true);
					return false;
				}
			}
		});
	});
}

async function runGame(plans, Display) {
	let lives = 3;
	for (let level=0; level < plans.length;) {
		console.log(lives);
		let status = await runLevel(new Level(plans[level]), Display);
		if (status == "won") level++;
		if (status == "lost") lives--;
		if (lives <= 0) {
			console.log("You've lost");
			level = 0;
			lives = 3;
		}
	}
	console.log("You've won!");
}

runGame(GAME_LEVELS, DOMDisplay);