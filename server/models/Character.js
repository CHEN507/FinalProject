class Character {
    constructor(name, isGood) {//創建角色的同時 指定角色好壞
        this.name = name;
        this.isGood = isGood;
        this.isAssassinated = false;
        this.isAccused = 0;
    }
}

module.exports = Character;
