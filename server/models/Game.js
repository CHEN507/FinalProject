const uuidv4 = require('uuid/v4');
const userService = require('../service/user-service');//import user-service
const Quest = require('./Quest');
const Character = require('./Character');
const STATUS = require('./Status'); 
const { ACCUSE, ASSASSIN, VOTING, TOASSASSIN, MAGIC_GIVE } = require('./Status');//加上好人指認 //加上刺客選擇是否刺殺 //加上給魔法
const { all } = require('../router');

const GAME_RULES = {
    '4': {
        good: 2,
        evil: 2,
        questPlayers: [2, 3, 3, 2, 2]
    },

    '5': {
        good: 3,
        evil: 2,
        questPlayers: [2, 3, 2, 3, 3]
    },
    '6': {
        good: 4,
        evil: 2,
        questPlayers: [2, 3, 4, 3, 4]
    },
    '7': {
        good: 4,
        evil: 3,
        questPlayers: [2, 3, 3, 4, 4]
    },
    '8': {
        good: 5,
        evil: 3,
        questPlayers: [3, 4, 4, 5, 5]
    },
    '9': {
        good: 6,
        evil: 3,
        questPlayers: [3, 4, 4, 5, 5]
    },
    '10': {
        good: 6,
        evil: 4,
        questPlayers: [3, 4, 4, 5, 5]
    },
};

const QUESTS_NUMBER = 5;

class Game {//下面所有東西都寫在Game的class下面
    constructor(gameSetting) {//Game的建構式
        this.id = uuidv4();
        this.name = gameSetting.name;
        this.playerNumber = gameSetting.playerNumber;
        this.creator = gameSetting.creator;//房主?
        this.optionalCharacters = gameSetting.optionalCharacters;
        this.userNumber = 0;
        this.users = {};
        this.userIds = [];
        this.quests = [];
        this.characters = [];
        this.currLeaderIndex = 0;
        this.status = STATUS.INIT;
        this.gameRule = GAME_RULES[gameSetting.playerNumber];
        this.summary = {
            good: this.gameRule.good,
            evil: this.gameRule.evil,
            characters: ['Merlin', 'Assassin']
        };
        this.summary.characters = [...this.summary.characters, ...Object.keys(this.optionalCharacters)];
        this.hasLady = this.optionalCharacters.hasOwnProperty('Lady of the lake');
        this.finishedQuests = 0;
        this.history = [];
        this.countDown = gameSetting.countDown || 0;
        this.toAssassin = null; //設定在Game裡面的toAssassin紀錄 //為了Accuse的Debug 先從null改成false
    }

    _createQuests() {
        for (let i = 0; i < QUESTS_NUMBER; i++) {
            let needsTwoFails = (i === 3 && this.playerNumber >= 7) ? true : false;
            this.quests.push(new Quest(this.gameRule.questPlayers[i], needsTwoFails));
        }
    }

    _createCharacters() {
        let ruleLimit = Object.assign({}, this.gameRule);
        //this.characters.push(new Character('Merlin', true, false));
        this.characters.push(new Character('Assassin', false, false));
        this.characters.push(new Character('Morgana', false, false));
        //ruleLimit.good--;
        ruleLimit.evil=0;

        Object.keys(this.optionalCharacters).forEach(characterName => {
            if (characterName === 'Percival') {
                this.characters.push(new Character('Percival', true, false));
                ruleLimit.good--;
            }
            else if (characterName === 'Mordred' || characterName === 'Morgana' || characterName === 'Oberon') {
                this.characters.push(new Character(characterName, false, false));
                ruleLimit.evil--;
            }
        });
        //好人角色三選二(Merlin, young, board)
        if(ruleLimit.good){
            let RandomCharacters = Math.floor(Math.random()*3)+1;
            switch(RandomCharacters){
            case 1:
                this.characters.push(new Character('young', true));
                this.characters.push(new Character('Merlin', true));
                break;
            case 2:
                this.characters.push(new Character('young', true));
                this.characters.push(new Character('board', true));
                break;
            case 3:
                this.characters.push(new Character('Merlin', true)); 
                this.characters.push(new Character('board', true));
                break;    
            }
        }
        /*
        for (let i = 0; i < ruleLimit.good; i++) {
            this.characters.push(new Character('Loyal Servant', true, false));
        }*/

        for (let i = 0; i < ruleLimit.evil; i++) {
            this.characters.push(new Character('Evil Minion', false, false));
        }
    }

    initialize() {//遊戲初始化
        this.addUser(this.creator);
        this.changeUserStatus(this.creator, STATUS.READY);
        this.setLeader(this.creator);//隨機指派隊長
        this._createQuests();
        this._createCharacters();
    }

    startGame(userId) {
        if (userId !== this.creator) {
            return false;
        }

        let copyCharacters = this.characters.slice();
        //隨機指派角色給玩家
        this.userIds.forEach(userId => {
            const user = this.users[userId];
            const randIndex = Math.floor(Math.random() * copyCharacters.length);
            user.gameInfo.character = copyCharacters[randIndex];
            copyCharacters.splice(randIndex, 1);
        });

        this.status = STATUS.REVIEW;
        this.changeAllUserStatus(STATUS.REVIEW);

        // Assign lady card
        if (this.hasLady) {
            const randomUserId = this.userIds[Math.floor(Math.random() * this.userIds.length)];
            this.users[randomUserId].gameInfo.hasLady = true;
        }

        return true;
    }

    setFifthPlayer(firstRound) {
        this.userIds.forEach(userId => {
            const currUser = this.users[userId];
            currUser.gameInfo.isFifth = false;
        });

        let increment = firstRound ? 4 : 5;

        let fifthIndex = this.currLeaderIndex + increment;
        if (fifthIndex > this.userIds.length - 1) {
            fifthIndex = fifthIndex - this.userIds.length;
        }
        this.users[this.userIds[fifthIndex]].gameInfo.isFifth = true;
    }

    addUser(userId) {
        if (this.users[userId]) {
            return true;
        }

        if (this.userNumber === this.playerNumber) {
            return false;
        }

        const newUser = userService.getUser(userId);
        if (!newUser) {
            return false;
        }

        for (let i = 0; i < this.userIds.length; i++) {
            const currUser = this.users[this.userIds[i]];
            if (currUser.userName === newUser.userName) {
                return false;
            }
        }

        this.userNumber++;

        this.users[userId] = newUser;
        this.users[userId].gameInfo = {
            id: this.id,
            status: STATUS.NOT_READY,
            character: null,
            leader: false,
            selected: false,
            hasLady: false,
            hadLady: false,
            isFifth: false,
            hasGivedMagic: false,//是否已經施過魔法
            hasMagic: false, //現在有沒有被施魔法
            hasAccused: false,//玩家是否進行過指控壞人的行為
            toAssassin: null//刺客是否要進行暗殺
        };

        this.userIds.push(userId);

        return true;
    }

    changeAllUserStatus(status) {
        Object.keys(this.users).forEach(userId => {
            const currUser = this.users[userId];
            currUser.gameInfo.status = status;
        });
    }

    /*
    //保留原始程式碼
    startQuest() {
        this.status = STATUS.QUEST_TEAMING;//隊長指派人出任務
        const currLeader = this.users[this.userIds[this.currLeaderIndex]];
        currLeader.gameInfo.leader = false;

        this.currLeaderIndex = Math.floor(Math.random() * this.userIds.length);//隨機分配隊長
        const leaderId = this.userIds[this.currLeaderIndex];
        const leader = this.users[leaderId];
        leader.gameInfo.leader = true;

        this.changeAllUserStatus(STATUS.WAITING);
        this.changeUserStatus(leaderId, STATUS.LEADER);
        // this.changeUserStatus(leaderId, STATUS.MAGIC_GIVE); //把魔法環節塞進去
        this.setFifthPlayer(true);
    }
    */
    startQuest() {
        const currLeader = this.users[this.userIds[this.currLeaderIndex]];//現任隊長

        if(currLeader.gameInfo.hasGivedMagic === false){
            this.status = STATUS.MAGIC_GIVE;
            this.changeAllUserStatus(STATUS.MAGIC_GIVE);
            // this.changeUserStatus(currLeader.id, STATUS.MAGIC_GIVE); //把魔法環節塞進去
        }
        else{
            this.status = STATUS.QUEST_TEAMING;//隊長指派人出任務
            currLeader.gameInfo.leader = false;

            this.currLeaderIndex = Math.floor(Math.random() * this.userIds.length);//隨機分配下一位隊長
            const leaderId = this.userIds[this.currLeaderIndex];//下一位隊長
            const leader = this.users[leaderId];
            leader.gameInfo.leader = true;
    
            this.changeAllUserStatus(STATUS.WAITING);//waiting -> 等三秒
            this.changeUserStatus(leaderId, STATUS.LEADER);
            this.setFifthPlayer(true);
        }
    }

    //隊長指派人施魔法的動作
    giveMagic(requesterId, targetId){//其實這個requesterId就是現任leader
        const target = this.users[targetId]
        const requester = this.users[requesterId];
        if (!target || !requester) {
            return false;
        }

        target.gameInfo.hasMagic = true;//把被隊長指派的人的hasMgaic=true
        requester.gameInfo.hasGivedMagic = true;

        this.startQuest()
    
        return true;

    }

    //改變隊長/湖中女神的Status
    changeUserStatus(userId, status) {
        const user = this.users[userId];
        if (!user || !status) {
            return false;
        }

        user.gameInfo.status = status;

        if (this.status === STATUS.REVIEW) {
            // In review, check if every one is ready
            let allReady = true;

            this.userIds.forEach(userId => {
                const currUser = this.users[userId];
                if (currUser.gameInfo.status !== 'Ready') {
                    allReady = false;
                }
            });

            //保留原程式碼
            if (allReady) {
                this.startQuest();
            }

            //全部人都準備好，且現任隊長已經指派人給過魔法
            // if (allReady && this.users[this.currLeaderIndex].hasGivedMagic) {
            //      this.startQuest();
            //  }
            // else if(this.this.users[this.currLeaderIndex].hasGivedMagic){
            //     alert('隊長還沒指派人給魔法')
            // }

        }
        else if (this.status === STATUS.VOTING) {//對派出的隊伍投票(Yes/No)
            let allVoted = true;

            this.userIds.forEach(userId => {
                const currUser = this.users[userId];
                if (currUser.gameInfo.status !== 'Yes' && currUser.gameInfo.status !== 'No') {
                    allVoted = false;
                }
            });

            if (allVoted) {
                this.status = STATUS.QUEST_REVIEW;
            }
        }
        else if (this.status === STATUS.QUEST_GOING) {//出好壞杯(Success/Fail)
            let allVoted = true;
            let fails = 0;
            let selectedUserNames = [];

            this.userIds.forEach(userId => {
                const currUser = this.users[userId];
                if (!currUser.gameInfo.selected) {
                    return;
                }

                selectedUserNames.push(currUser.userName);

                if (currUser.gameInfo.status !== 'Success' && currUser.gameInfo.status !== 'Fail') {
                    allVoted = false;
                }

                if (currUser.gameInfo.status === 'Fail') fails++;
            });

            if (allVoted) {
                let selectedQuest = null;
                let selectedQuestNumber = -1;

                for (let i = 0; i < this.quests.length; i++) {
                    if (this.quests[i].selected) {
                        selectedQuest = this.quests[i];
                        selectedQuestNumber = i + 1;
                        break;
                    }
                }

                if (selectedQuest.needsTwoFails && fails >= 2) {
                    selectedQuest.status = 'Failed';
                }
                else if (!selectedQuest.needsTwoFails && fails >= 1) {
                    selectedQuest.status = 'Failed';
                }
                else {
                    selectedQuest.status = 'Success';
                }

                selectedQuest.fails = fails;
                if (selectedUserNames.length) {
                    selectedQuest.players = selectedUserNames.join(', ');
                    let historyEntry = `${selectedQuest.players} went to Quest${selectedQuestNumber} and it's ${selectedQuest.status}`;
                    this.history.push(historyEntry);
                }
                this.finishedQuests++;

                this.endGameOrNextRound();
            }
        }
        else if (this.status === STATUS.QUEST_REVIEW) {
            let allReady = true;

            this.userIds.forEach(userId => {
                const currUser = this.users[userId];
                const statuses = currUser.gameInfo.status.split('.');

                if (statuses.length < 2 || statuses[1] !== 'Reviewed') {
                    allReady = false;
                }
            });

            if (allReady) {
                this.moveToQuestOrNextRound();
            }
        }
        else if (this.status === STATUS.LADY_REVIEW) {
            // In review, check if every one is ready
            let allReady = true;

            this.userIds.forEach(userId => {
                const currUser = this.users[userId];
                if (
                    currUser.gameInfo.status !== 'Reviewed' &&
                    currUser.gameInfo.status !== 'Good.Reviewed' &&
                    currUser.gameInfo.status !== 'Evil.Reviewed'
                ) {
                    allReady = false;
                }
            });

            if (allReady) {
                this.toNextRound();
            }
        }

        return true;
    }

    moveToQuestOrNextRound() {
        let yes = 0;
        let no = 0;

        this.userIds.forEach(userId => {
            const currUser = this.users[userId];
            if (currUser.gameInfo.status === 'Yes.Reviewed') yes++;
            if (currUser.gameInfo.status === 'No.Reviewed') no++;
        });

        const currLeader = this.users[this.userIds[this.currLeaderIndex]];

        // Quest goes
        if (yes > no || currLeader.gameInfo.isFifth) {
            this.status = STATUS.QUEST_GOING;
            this.userIds.forEach(userId => {
                const currUser = this.users[userId];

                if (currUser.gameInfo.selected) {
                    currUser.gameInfo.status = STATUS.VOTING;
                }
                else {
                    currUser.gameInfo.status = STATUS.WAITING;
                }
            });
        }
        else {
            this.toNextRound();
        }
    }

    toNextRound(setFifth) {
        this.status = STATUS.QUEST_TEAMING;
        this.clearSelections(STATUS.WAITING);

        if (setFifth) {
            this.setFifthPlayer();
        }

        this.users[this.userIds[this.currLeaderIndex]].gameInfo.leader = false;
        this.currLeaderIndex = (this.currLeaderIndex === this.userIds.length - 1) ? 0 : this.currLeaderIndex + 1;
        this.users[this.userIds[this.currLeaderIndex]].gameInfo.leader = true;
        this.users[this.userIds[this.currLeaderIndex]].gameInfo.status = STATUS.LEADER;
        //this.users[this.userIds[this.currLeaderIndex]].gameInfo.status = STATUS.MAGIC_GIVE; //把魔法環節塞進去
    }
    //STATUS觸發，ex:STATUS.WAITING狀態
    clearSelections(userStatus) {
        this.quests.forEach(quest => quest.selected = false); //把對Quest(回合)的選擇清零
        this.userIds.forEach(userId => {
            const currUser = this.users[userId];
            currUser.gameInfo.status = userStatus;//使所有玩家的gameInfo.status = 指定的STATUS
            currUser.gameInfo.selected = false;//把對玩家的選擇清零
        });
    }

    //刺客決定是否暗殺的動作(去接收GameBoard的PayLoad)
    toAssassinate(toAssassin) {
        if (toAssassin){
            this.toAssassin = true;
        }
        else{
            this.toAssassin = false;
        }
        alert(`toAssassin = ${toAssassin} this.toAssassin = ${this.toAssassin}`)
        return true;
    }
    

    endGameOrNextRound() {
        let success = 0;
        let fails = 0;

        this.quests.forEach(quest => {
            if (quest.status === 'Success') success++;
            if (quest.status === 'Failed') fails++;
        });

        //好人累積三個成功時，刺客必須刺殺
        if (success === 1) {//為Debug方便 先把3改成1
            this.status = STATUS.ASSASSIN;
            this.clearSelections(STATUS.WAITING);
        }

        /*保留原本的程式碼
        else if (fails === 3) {
            this.status = STATUS.END_EVIL;
            this.clearSelections(STATUS.QUEST_REVIEW);
        }
        */
        
        //壞方累積兩個任務失敗，詢問刺客是否選擇刺殺
        else if (fails === 1) {//回報寫法給UI/UX!!! 為了Debug先把它從2改成1

        //詢問刺客是否選擇刺殺 補上刺客是否暗殺的STATUS
        this.status = STATUS.TOASSASSIN;
        this.clearSelections(STATUS.WAITING);

        //刺客選擇刺殺，進入刺殺環節
            if(this.toAssassin === true){
                this.status = STATUS.ASSASSIN;
                this.clearSelections(STATUS.WAITING);
            }
        //刺客若選擇不刺殺，進入好人指認
            if(this.toAssassin === false){
                this.status = STATUS.ACCUSE;
                this.clearSelections(STATUS.WAITING);
            }
        }

        else {
            if (this.hasLady && this.finishedQuests > 1) {
                // Start Lady phase
                this.status = STATUS.LADY_GIVE;
                this.clearSelections(STATUS.WAITING);
                this.userIds.forEach(userId => {
                    const currUser = this.users[userId];
                    if (currUser.gameInfo.hasLady) {
                        this.changeUserStatus(userId, STATUS.LADY_GIVE);
                    }
                });
                this.setFifthPlayer();
            }
            else {
                this.toNextRound(true);
            }
        }
    }

    doQuest(questUsers, questIndex) {
        questUsers.forEach(userId => {
            this.users[userId].gameInfo.selected = true;
        });

        this.quests[questIndex].selected = true;
        const currLeader = this.users[this.userIds[this.currLeaderIndex]];
        if (currLeader.gameInfo.isFifth) {
            this.moveToQuestOrNextRound();
        }
        else {
            this.status = STATUS.VOTING;
            this.changeAllUserStatus(STATUS.VOTING);
        }

        return true;
    }

    // 刺殺動作(原程式碼)
    // assassinate(targetId) {
    //     const killTarget = this.users[targetId];
    //     if (!killTarget) {
    //         return false;
    //     }

    //     killTarget.gameInfo.character.isAssassinated = true;
        
    //     if (killTarget.gameInfo.character.name !== 'Merlin') {
    //         this.status = STATUS.END_GOOD;
    //     }
    //     else {
    //         this.status = STATUS.END_EVIL;
    //     }

    //     return true;
    // }

    // 刺殺動作(已改完)
    assassinate(targetId) {
        const killTarget1 = this.users[targetId[0]];
        const killTarget2 = this.users[targetId[1]];
        if (!killTarget1 || !killTarget2){
            return false;
        }

        killTarget1.gameInfo.character.isAssassinated = true;
        killTarget2.gameInfo.character.isAssassinated = true;

        if (killTarget1.gameInfo.character.isGood && //待修
            killTarget2.gameInfo.character.isGood &&
            killTarget1.gameInfo.character.name === 'Merlin'||'board'||'young' && //待修
            killTarget2.gameInfo.character.name === 'Merlin'||'board'||'young') {
            this.status = STATUS.END_EVIL;
        }
        else {
            this.status = STATUS.END_GOOD;
        }

        return true;
    }

    //好人指認的動作
    accuse(targetId, goodUserIds) {
        const AccuseTarget1 = this.users[targetId[0]];
        const AccuseTarget2 = this.users[targetId[1]];
        const goodUser1 = this.users[goodUserIds[0]];
        const goodUser2 = this.users[goodUserIds[1]];

        if (!AccuseTarget1 || !AccuseTarget2 || !goodUser1 || !goodUser2) {
            return false;
        }

        AccuseTarget1.gameInfo.character.isAccused++;
        AccuseTarget2.gameInfo.character.isAccused++;

    //驗證好人都已經投過票了之後，
    //如果Morgana的isAccused === 2 且 Assassin的isAccused ===2 就進入END_GOOD 其他狀況的話進入END_EVIL
        let allAccused = false;    
        let trueAccuse = 0;
        alert(`allAccused ${allAccused} trueAccuse ${trueAccuse}`)
        if(goodUser1.gameInfo.hasAccused && goodUser2.gameInfo.hasAccused ){
            allAccused = true;
            for (let i = 0; i < this.userIds.length; i++) {
                const currUser = this.users[this.userIds[i]];
                if (currUser.gameInfo.character.name === 'Assassin' && currUser.gameInfo.character.isAccused === 2){
                    trueAccuse++
                }
                if (currUser.gameInfo.character.name === 'Morgana' && currUser.gameInfo.character.isAccused === 2){
                    trueAccuse++
                }
            }
        }

        if(allAccused && trueAccuse === 2){
            this.status = STATUS.END_GOOD;
        }
        else if(allAccused && trueAccuse !== 2){
        this.status = STATUS.END_EVIL;
        }

        return true;
    }


/*原程式碼保留
        if (this.user.gameInfo.character.isAccused === 2 && 
            AccuseTarget2.gameInfo.character.name === 'Assassin' && AccuseTarget2.gameInfo.character.isAccused === 2) {
            this.status = STATUS.END_GOOD;
        }

        else if (AccuseTarget1.gameInfo.character.name === 'Assassin' && AccuseTarget1.gameInfo.character.isAccused === 2 && 
            AccuseTarget2.gameInfo.character.name === 'Morgana' && AccuseTarget2.gameInfo.character.isAccused === 2) {
            this.status = STATUS.END_GOOD;
        }

        else {
            this.status = STATUS.END_EVIL;
        }

        return true;

    }
*/

    giveLady(requesterId, targetId) {
        const target = this.users[targetId];
        const requester = this.users[requesterId];
        if (!target || !requester) {
            return false;
        }

        target.gameInfo.selected = true;

        if (target.gameInfo.character.isGood) {
            target.gameInfo.status = 'Good';
        }
        else {
            target.gameInfo.status = 'Evil';
        }

        this.status = STATUS.LADY_INVESTIGATING;
        requester.gameInfo.status = STATUS.LADY_INVESTIGATING;

        return true;
    }

    claimsGood(requesterId, targetId, isGood) {
        const target = this.users[targetId];
        const requester = this.users[requesterId];
        if (!target || !requester) {
            return false;
        }

        this.status = STATUS.LADY_REVIEW;
        this.changeAllUserStatus(STATUS.REVIEW);

        if (isGood) {
            target.gameInfo.status = 'Good';
        }
        else {
            target.gameInfo.status = 'Evil';
        }

        requester.gameInfo.hadLady = true;
        requester.gameInfo.hasLady = false;
        target.gameInfo.hasLady = true;

        return true;
    }

    setLeader(userId) {
        const user = this.users[userId];
        if (!user) {
            return;
        }

        const currLeader = this.users[this.currLeaderIndex];
        if (currLeader) {
            currLeader.gameInfo.leader = false;
        }

        user.gameInfo.leader = true;

        for (let i = 0; i < this.userIds.length; i++) {
            if (this.userIds[i] === userId) {
                this.currLeaderIndex = i;
            }
        }
    }

    removeUser(userId) {
        if (!this.users[userId]) {
            return false;
        }
        
        this.userNumber--;
        this.users[userId].gameInfo = null;
        delete this.users[userId];
        let indexToRemove = -1;

        this.userIds.forEach((id, i) => {
            if (id === userId ) {
                indexToRemove = i;
            }
        });

        if (indexToRemove >= 0) {
            this.userIds.splice(indexToRemove, 1);
        }

        return true;
    }

    getUsers() {
        return this.userIds.map(userId => this.users[userId]);
    }

    getFilteredUsers(userId) {//依狀態提示玩家身分
        if (!this.users[userId]) {
            return [];
        }

        const requesterRole = this.users[userId].gameInfo.character;
        const requester = this.users[userId];
        if (
            !requesterRole ||
            this.userIds.length < this.playerNumber
        ) {
            return this.getUsers();
        }

        return this.userIds.map(id => {
            // Deep copy user 
            let userObj = JSON.parse(JSON.stringify(this.users[id]));
            const userRole = userObj.gameInfo.character;
            if (!userRole) {
                return userObj;
            }

            if (this.status === STATUS.END_EVIL || this.status === STATUS.END_GOOD) {
                if (userRole.isAssassinated) {
                    userObj.gameInfo.status = `${userRole.name} Killed`;
                }
                //加上壞方被指控狀態提示
                else if(userRole.isAccused>0){
                    userObj.gameInfo.status = `${userRole.name} Accused ${userRole.isAccused} time(s)`;//從這裡改
                }
                else {
                    userObj.gameInfo.status = userRole.name;
                }
            }

            if (this.status === STATUS.ASSASSIN) {
                if (userRole.isGood) {
                    userObj.gameInfo.status = 'Good';//userObj.gameInfo.status：玩家小方框右邊顯示的狀態
                }
                else if (userRole.name === 'Assassin') {
                    userObj.gameInfo.status = 'Assassin';
                }
                else if (!userRole.isGood) {
                    userObj.gameInfo.status = userRole.name;
                }
            }
            // 增加好人指控環節時，各玩家小方框右邊顯示的狀態
            if (this.status === STATUS.ACCUSE) {
                if (userObj.gameInfo.hasAccused) {
                    userObj.gameInfo.status = ' ';//幫助辨認
                }
            }
            /*
            if (this.status === STATUS.ACCUSE) {
                if (userRole.isGood) {
                    userObj.gameInfo.status = 'Good';
                }
                else if (userRole.name === 'Merlin') {
                    userObj.gameInfo.status = 'Merlin';
                }
                else if (!userRole.isGood) { 
                    userObj.gameInfo.status = userRole.name;
                }
            }
            */

            //增加隊長指定人施魔法的時候，各玩家小方框右邊顯示的狀態
            if (this.status === STATUS.MAGIC_GIVE) {
                if (!userObj.gameInfo.leader && !userObj.gameInfo.selected) {
                    userObj.gameInfo.status = STATUS.WAITING;
                }
                // else if(userObj.gameInfo.leader) { 
                //     userObj.gameInfo.status = STATUS.MAGIC_GIVE;
                // }
            }
            

            if (this.status == STATUS.LADY_INVESTIGATING) {
                if (!userObj.gameInfo.hasLady && !userObj.gameInfo.selected) {
                    userObj.gameInfo.status = STATUS.WAITING;
                }
                else if (!requester.gameInfo.hasLady && userObj.gameInfo.selected) {
                    userObj.gameInfo.status = STATUS.LADY_INVESTIGATED;
                }
            }

            if (id === userId) {
                return userObj;
            }

            if (
                (requesterRole.name === 'Merlin' && (userRole.isGood || userRole.name ==='Mordred')) ||
                (requesterRole.name === 'Percival' && userRole.name !== 'Merlin' && userRole.name !== 'Morgana') ||
                (!requesterRole.isGood && requesterRole.name !=='Oberon' && (userRole.isGood || userRole.name === 'Oberon')) ||
                (requesterRole.name === 'Loyal Servant') ||
                (requesterRole.name === 'Oberon')
            ) {
                userObj.gameInfo.character = null;
            }

            if (this.status === STATUS.QUEST_GOING) {
                if (userObj.gameInfo.selected && userObj.gameInfo.status !== STATUS.VOTING) {
                    userObj.gameInfo.status = 'Voted';
                }
            }

            return userObj;
        });
    }

    clearGame() {
        this.userIds.forEach(userId => {
            const user = this.users[userId];
            user.gameInfo = null;
        });
    }
    //這邊有PayLoad??
    serialize(requesterId) {
        let payloadUsers = [];
        if (!requesterId) {
            payloadUsers = this.getUsers();
        }
        else {
            payloadUsers = this.getFilteredUsers(requesterId);
        }

        return {
            id: this.id,
            name: this.name,
            users: payloadUsers,
            creator: this.creator,
            playerNumber: this.playerNumber,
            quests: this.quests,
            summary: this.summary,
            status: this.status,
            history: this.history,
            countDown: this.countDown
        };
    }
}

module.exports = Game;
