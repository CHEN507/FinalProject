﻿import React from 'react';
import PropTypes from 'prop-types';
import { Portal } from 'react-portal';
import Button from './Button.jsx';
import Card from './Card.jsx';
import CharacterCard from './CharacterCard.jsx';
import PlayerCard from './PlayerCard.jsx';
import QuestBoard from './QuestBoard.jsx';
import Modal from './Modal.jsx';
import * as util from '../util';
import '../css/game.scss';
import '../css/layout.scss';

export default class GameBoard extends React.Component {
    static get propTypes() {
        return {
            history: PropTypes.any,
            'history.push': PropTypes.func,
            gameInfo: PropTypes.object,
            changeGameHandler: PropTypes.func,
            'gameInfo.users': PropTypes.array
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            alertText: '',
            actionsAlert: '',
            currUserId: null,
            leaveGameModalOpen: false,
            gameBrokenNoticeModalOpen: false,
            countDown: props.gameInfo.countDown,
            countDownId: null
        };

        this.creatorBackToLobby = this.creatorBackToLobby.bind(this);
        this.playerBackToLobby = this.playerBackToLobby.bind(this);
        this.startGame = this.startGame.bind(this);
        this.readyGame = this.readyGame.bind(this);
        this.setAlert = this.setAlert.bind(this);
        this.clearAlert = this.clearAlert.bind(this);
        this.setActionsAlert = this.setActionsAlert.bind(this);
        this.clearActionsAlert = this.clearActionsAlert.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.getReadyText = this.getReadyText.bind(this);
        this.readyReview = this.readyReview.bind(this);
        this.confirmTeaming = this.confirmTeaming.bind(this);
        this.playerCardSelectHandler = this.playerCardSelectHandler.bind(this);
        this.questSelectHandler = this.questSelectHandler.bind(this);
        this.reviewQuest = this.reviewQuest.bind(this);
        this.assassinate = this.assassinate.bind(this);//暗殺動作的綁定
        this.accuse = this.accuse.bind(this);//加上好人指認
        this.giveLady = this.giveLady.bind(this);
        //this.giveMagic = this.giveMagic.bind(this);//加上隊長指定人施魔法
        this.claimsGood = this.claimsGood.bind(this);
        this.reviewLadyResult = this.reviewLadyResult.bind(this);
        this.disableLadyReview = this.disableLadyReview.bind(this);
        this.closeLeaveGameModal = this.closeLeaveGameModal.bind(this);
        this.openLeaveGameModal = this.openLeaveGameModal.bind(this);
        this.leaveGameModalConfirm = this.leaveGameModalConfirm.bind(this);
        this.getLeaveGameModalText = this.getLeaveGameModalText.bind(this);
        this.openGameBrokenNoticeModal = this.openGameBrokenNoticeModal.bind(this);
        this.closeGameBrokenNoticeModal = this.closeGameBrokenNoticeModal.bind(this);
        this.gameBrokenNoticeModalConfirm = this.gameBrokenNoticeModalConfirm.bind(this);
        this.dispatchCountDownEvent = this.dispatchCountDownEvent.bind(this);
        this.setUpCountDown = this.setUpCountDown.bind(this);
    }

    componentDidMount() {
        const self = this;

        util.getUser().then(user => {
            self.setState({
                currUserId: user.id
            });
        });

        util.subScribeLeaveGame(gameId => {
            const currGameId = util.getGameId();
            if (gameId === currGameId) {
                util.clearGameId();
                self.openGameBrokenNoticeModal();
            }
        });
    }

    componentDidUpdate() {
        this.setUpCountDown();
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.countDown === 0) {
            this.setState({
                countDown: nextProps.gameInfo.countDown
            });
        }
    }
    
    getCurrentUser() {
        for (let i = 0; i < this.props.gameInfo.users.length; i++) {
            if (this.props.gameInfo.users[i].id === this.state.currUserId) {
                return this.props.gameInfo.users[i];
            }
        }
    }

    getReadyText() {
        const currUser = this.getCurrentUser();
        return (currUser && currUser.gameInfo.status === 'Ready') ? 'Cancel' : 'Ready';
    }

    getGameSummary() {
        const summary = this.props.gameInfo.summary;
        if (summary) {
            let summaryText = `Good: ${summary.good}, Evil: ${summary.evil}, Special Characters: `;
            let prefix = '';
            summary.characters.forEach(characterName => {
                summaryText += `${prefix} ${characterName}`;
                prefix = ',';
            });
            return summaryText;
        }
    }
    //玩遊戲的時候，最上面的那欄主要提示
    getNotice() {
        const currUser = this.getCurrentUser();

        if (!this.props.gameInfo.status || !currUser) {
            return '';
        }

        switch(this.props.gameInfo.status) {
        case 'Init': {
            return '';
        }
        case 'Review': {
            return 'Look at your Identity card and information you know. Click Ready in the actions section when finished. Remeber to hide the information';
        }
        case 'Teaming': {
            if (currUser.gameInfo.leader) {
                if (currUser.gameInfo.isFifth) {
                    return 'This is the fifth round and your team will go';
                }
                else {
                    return 'Choose a quest and team members. Click Confirm when finished.';
                }
            }
            else {
                for (let i = 0; i < this.props.gameInfo.users.length; i++) {
                    if (this.props.gameInfo.users[i].gameInfo.leader && this.props.gameInfo.users[i].gameInfo.isFifth) {
                        return 'This is the fifth round. Please wait for the leader to pick a team.';
                    }
                }

                return 'Please wait for the current quest leader to choose a quest and team.';
            }
        }
        case 'Voting': {
            return 'The chosen quest and players are highlighted. Please Vote. You can not change vote after clicking Yes or No';
        }
        case 'QuestReview': {
            let yes = 0;
            let no = 0;
            this.props.gameInfo.users.forEach(user => {
                if (user.gameInfo.status === 'Yes.Reviewed' || user.gameInfo.status === 'Yes') yes++;
                if (user.gameInfo.status === 'No.Reviewed' || user.gameInfo.status === 'No') no++;
            });

            if (yes > no) {
                return 'The selected quest is approved. Please review the voting and click next';
            }
            else {
                return 'The selected quest is not approved. Please review the voting and click next';
            }
        }
        case 'QuestGoing': {
            if (!currUser.gameInfo.selected) {
                return 'Please wait for the selected players to vote for the quest';
            }
            else {
                return 'Please decide if the quest should success or fail. Only you can see your vote. You may not change your vote after clicking the buttons';
            }
        }
        case 'GoodEnd': {
            return 'Good has won';
        }
        case 'EvilEnd': {
            return 'Evil has won';
        }
        //主提示欄顯示的暗殺提示
        case 'Assassinating': {
            return 'Good and evils are revealed and Assassin will choose a character to kill';
        }
        //加上好人指認
        case 'Accusing':{
            return 'Good will choose two characters to accuse'
        }
        case 'Giving lady': {
            if (!currUser.gameInfo.hasLady) {
                return 'Please wait for the Lady of the lake investigation';
            }
            else {
                return 'Please select a player to investigate. The player must not have owned Lady card before';
            }
        }
        //加上隊長指定人施魔法
        // case 'Giving magic': {
        //     if (!currUser.gameInfo.leader) {
        //         return 'Please select a player to give magic.';
        //     }
        //     else {
        //         return 'Please wait for the Leader giving magic';
        //     }
        // }
        case 'Investigating': {
            if (!currUser.gameInfo.hasLady && !currUser.gameInfo.selected) {
                return 'Please wait for the Lady of lake to investigate the selected player';
            }
            else if (currUser.gameInfo.selected) {
                return 'Your identity is revealed to the player who owns Lady of the lake card';
            }
            else {
                return 'Please look at the selected player\'s identity and decide what you want to claim the player to be';
            }
        }
        case 'LadyReview': {
            return 'Please review the selected user\'s investigation result. Remember this only reflect the lady card owner\'s claim';
        }
        default: {
            return '';
        }
        }
    }

    setAlert(text) {
        this.setState({
            alertText: text
        });
    }

    clearAlert() {
        this.setState({
            alertText: ''
        });
    }

    setActionsAlert(text) {
        this.setState({
            actionsAlert: text
        });
    }

    clearActionsAlert() {
        this.setState({
            actionsAlert: ''
        });
    }

    creatorBackToLobby() {
        const self = this;
        const currUser = self.getCurrentUser();
        if (!currUser) {
            return;
        }

        const deleteGameUri = `/api/game/${this.props.gameInfo.id}`;
        util.deleteRequest(deleteGameUri).then(deleteStatus => {
            if (deleteStatus === 404 ) {
                this.props.history.push('/lobby');
                return;
            }
            else if (deleteStatus !== 204) {
                return;
            }

            util.sendGameBroken(this.props.gameInfo.id);    
            util.clearGameId();
            util.sendGameListChanged();
            this.props.history.push('/lobby');
        });
    }

    playerBackToLobby() {
        const self = this;
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        const leaveGameUri = `/api/game/${this.props.gameInfo.id}/removeuser`;
        const payLoad = {
            user: {
                id: currUser.id
            }
        };

        util.putRequest(leaveGameUri, payLoad).then(res => {
            const changeRes = res.data;
            if (res.status === 404) {
                this.props.history.push('/lobby');
                return;
            }

            if (!changeRes.changeResolved) {
                return;
            }

            if (
                self.props.gameInfo.status !== 'Init' &&
                self.props.gameInfo.status !== 'GoodEnd' &&
                self.props.gameInfo.status !== 'EvilEnd'
            ) {
                util.sendGameBroken(self.props.gameInfo.id);
                util.sendGameListChanged();
            }
            else {
                util.sendGameChanged();    
            }

            util.clearGameId();
            this.props.history.push('/lobby');
        });
    }

    startGame() {
        const self = this;
        const userObjs = self.props.gameInfo.users;

        if (userObjs.length < self.props.gameInfo.playerNumber) {
            self.setAlert('Please wait for more players to join the game');
            return;
        }

        let allReady = userObjs.every(userObj => {
            return userObj.gameInfo.status === 'Ready';
        });

        if (!allReady) {
            self.setAlert('Not all players are ready');
            return;
        }

        const startGameUrl = `/api/game/${this.props.gameInfo.id}/startgame`;
        const payload = {
            user: {
                id: self.state.currUserId
            }
        };

        util.putRequest(startGameUrl, payload).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
                self.clearAlert();
            }
        });
    }

    readyGame() {
        const changeReadyUrl = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const currUser = this.getCurrentUser();
        let readyStatus = currUser.gameInfo.status;
        if (readyStatus === 'Ready') {
            readyStatus = 'Not Ready';
        }
        else {
            readyStatus = 'Ready';
        }

        const payload = {
            user: {
                id: currUser.id,
                status: readyStatus
            }
        };

        util.putRequest(changeReadyUrl, payload).then((res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        }));
    }

    readyReview() {
        const changeReadyUrl = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const currUser = this.getCurrentUser();

        const payload = {
            user: {
                id: currUser.id,
                status: 'Ready'
            }
        };

        util.putRequest(changeReadyUrl, payload).then((res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        }));
    }

    disableReviewButton() {
        const currUser = this.getCurrentUser();
        return currUser && currUser.gameInfo.status === 'Ready';
    }

    //隊長確認出賽隊伍
    confirmTeaming() {
        const currUsers = this.props.gameInfo.users;
        const currQuests = this.props.gameInfo.quests;

        const selectedUserIds = currUsers.reduce((result, currUser) => {
            if (currUser.gameInfo.selected) {
                result.push(currUser.id);
            }
            return result;
        }, []);

        const selectedQuestsIndex = currQuests.reduce((result, quest, i) => {
            if (quest.selected) {
                result.push(i);
            }
            return result;
        }, []);

        // Validate quest
        if (selectedQuestsIndex.length === 0) {
            this.setActionsAlert('Please select a quest');
            return;
        }
        else if (selectedQuestsIndex.length !== 1) {
            this.setActionsAlert('Please only select one quest');
            return;
        }

        const selectedIndex = selectedQuestsIndex[0];
        const selectedQuest = currQuests[selectedIndex];
        const neededPlayers = selectedQuest.playerNumber;

        if (selectedIndex === 4) {
            let doneQuests = 0;
            for (let i = 0; i < selectedIndex; i++) {
                if (currQuests[i].status === 'Success' || currQuests[i].status === 'Failed') {
                    doneQuests++;
                }
            }

            if (doneQuests < 2) {
                this.setActionsAlert('Please do first four quests');
                return;
            }
        }

        if (selectedUserIds.length !== neededPlayers) {
            this.setActionsAlert(`The selected quest needs ${neededPlayers} players`);
            return;
        }

        const doQuestUri = `/api/game/${this.props.gameInfo.id}/doquest`;
        const payLoad = {
            questUsers: selectedUserIds,
            questIndex: selectedIndex
        };

        util.putRequest(doQuestUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    disableVoteButton() {
        const currUser = this.getCurrentUser();
        return currUser && (currUser.gameInfo.status === 'Yes' || currUser.gameInfo.status === 'No');
    }

    voteQuest(vote) {
        const voteStatus = vote ? 'Yes' : 'No';

        const voteUri = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const currUser = this.getCurrentUser();

        const payLoad = {
            user: {
                id: currUser.id,
                status: voteStatus
            }
        };

        util.putRequest(voteUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    disableQuestReviewButton() {
        const currUser = this.getCurrentUser();
        return currUser && (currUser.gameInfo.status === 'Yes.Reviewed' || currUser.gameInfo.status === 'No.Reviewed');
    }

    reviewQuest() {
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        const changeStatusUri = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const payLoad = {
            user: {
                id: currUser.id,
                status: `${currUser.gameInfo.status}.Reviewed`
            }
        };

        util.putRequest(changeStatusUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    disableSuccessFailButton() {
        const currUser = this.getCurrentUser();
        return currUser && (currUser.gameInfo.status === 'Success' || currUser.gameInfo.status === 'Fail');
    }

    successFailQuest(vote) {
        const voteStatus = vote ? 'Success' : 'Fail';

        const voteUri = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const currUser = this.getCurrentUser();

        const payLoad = {
            user: {
                id: currUser.id,
                status: voteStatus
            }
        };

        util.putRequest(voteUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    //如果已經指認過壞人，就使Confirm按鈕失效
    disableAccuseButton(){
        // const currUser = this.getCurrentUser();
        // return currUser && currUser.gameInfo.hasAccused;
        if(this.props.gameInfo.status === 'Accusing' && (currUser && currUser.gameInfo.hasAccused === true)){
            return true;
        }
    }

    //刺殺相關的提示與防呆判斷(原程式碼)
    // assassinate() {
    //     const currUser = this.getCurrentUser();
    //     if (!currUser) {
    //         return;
    //     }

    //     const selectedUsers = this.props.gameInfo.users.reduce((result, currUser) => {
    //         if (currUser.gameInfo.selected) {
    //             result.push(currUser);
    //         }
    //         return result;
    //     }, []);

    //     if (selectedUsers.length !== 2) {
    //         this.setActionsAlert('Please select two players to kill');
    //         return;
    //     }

    //     const selectedUser = selectedUsers[0];
    //     if (selectedUser.id === currUser.id) {
    //         this.setActionsAlert('You can not assassinate yourself');
    //         return;
    //     }
    //     else if (selectedUser.gameInfo.status !== 'Good') {
    //         this.setActionsAlert('You should assassinate a good player');
    //         return;
    //     }

    //     const assassinUri = `/api/game/${this.props.gameInfo.id}/assassinate`;

    //     const payLoad = {
    //         user: {
    //             id: selectedUser.id
    //         }
    //     };

    //     util.putRequest(assassinUri, payLoad).then(res => {
    //         const changeRes = res.data;
    //         if (changeRes.changeResolved) {
    //             util.sendGameChanged();
    //         }
    //     });
    // }

   //刺殺相關的提示與防呆判斷(已改好)
        assassinate() {
            const currUsers = this.props.gameInfo.users;//房間裡所有的User
            const currUser = this.getCurrentUser();//此時currUser是刺客
            if (!currUser) {
                return;
            }
            //把被選取的User的isGood(角色好/壞)記錄在selectedUsersIsGood這個陣列裡面 (參考下面Teaming的寫法)
            // const selectedUsersIsGood = currUsers.reduce((result, currUser) => {
            //     if (currUser.gameInfo.selected) {
            //         result.push(currUser.gameInfo.character.isGood);
            //     }
            //     return result;
            // }, []);

            //把被選取的User的名字記錄在selectedUsersName這個陣列裡面 (參考下面Teaming的寫法)
            const selectedUsersName = currUsers.reduce((result, currUser) => {
                if (currUser.gameInfo.selected) {
                    result.push(currUser.gameInfo.character.name);
                }
                return result;
            }, []);

            //把選取的User的status(角色好/壞)在selectedUsersStatus這個陣列裡面
                const selectedUsersStatus = currUsers.reduce((result, currUser) => {
                if (currUser.gameInfo.selected) {
                    result.push(currUser.gameInfo.status);
                }
                return result;
            }, []);

            //把選取的User的Id記錄在selectedUserIds這個陣列裡面
            const selectedUserIds = currUsers.reduce((result, currUser) => {
                if (currUser.gameInfo.selected) {
                    result.push(currUser.id);
                }
                return result;
            }, []);
            
            if (selectedUserIds.length !== 2) {
                this.setActionsAlert('Please select two players to kill');
                return;
            }
            if (selectedUserIds.includes(currUser.id)) {
                this.setActionsAlert('You can not assassinate yourself');
                return;
            }

            // else if (!selectedUsersStatus.includes('Good','Good')) {
            //     this.setActionsAlert('You should assassinate good players');
            //     return;
            // } //這個可以成功通到Game.js

            // else if (selectedUsersIsGood.includes(true)) {
            //     this.setActionsAlert('You should assassinate good players');
            //     return;
            // }

            else if (selectedUsersName.includes('Morgana')) {
                this.setActionsAlert('You should assassinate good players');
                return;
            }

            const assassinUri = `/api/game/${this.props.gameInfo.id}/assassinate`;

            const payLoad = {
                user: {
                    id: selectedUserIds
                }
            };

            util.putRequest(assassinUri, payLoad).then(res => {
                const changeRes = res.data;
                if (changeRes.changeResolved) {
                    util.sendGameChanged();
                }
            });

            //alert(`currUsers = ${currUsers} currUser = ${currUser} selectedUsersStatus = ${selectedUsersStatus} selectedUserIds = ${selectedUserIds}`)
            alert(`currUsers.gameInfo.character.name = ${currUsers.gameInfo.character.name} currUser = ${currUser.gameInfo.character.name} selectedUsersStatus = ${selectedUsersStatus} selectedUserIds = ${selectedUserIds}`)

            //顯示一下現在狀況(Debug用，實際玩不要開，會無法跳到下個環節)
            //alert(`currUsers = ${currUsers} currUser = ${currUser} selectedUsersStatus = ${selectedUsersStatus} selectedUserIds = ${selectedUserIds}`)
        }

    //增加好人指認的提示與防呆判斷(還沒改好)
    accuse() {
        const currUsers = this.props.gameInfo.users;//房間裡所有的User
        const currUser = this.getCurrentUser();//正在操作的好人本人
        if (!currUser) {
            return;
        }

        //把選取的User的Id記錄在selectedUserIds這個陣列裡面
        const selectedUserIds = currUsers.reduce((result, currUser) => {
            if (currUser.gameInfo.selected) {
                result.push(currUser.id);
            }
            return result;
        }, []);

        //防呆判斷_指控的人必須是兩個
        if (selectedUserIds.length !== 2) {
            this.setActionsAlert('Please select two players to accuse');
            // currUser.gameInfo.hasAccused = false;
            return;
        }
        //防呆判斷_好人不能指控自己
        else if (selectedUserIds.includes(currUser.id)) {
            this.setActionsAlert('You can not accuse yourself');
            // currUser.gameInfo.hasAccused = false;
            return;
        }
        // else{
        //     currUser.gameInfo.hasAccused = true;
        // }

        //將指控過的玩家hasAccused設定為true 放在最下面的時候，可以鎖定玩家方塊
        currUser.gameInfo.hasAccused = true;
/*
        //先移植過來看看
        currUsers[selectedUserIds[0]].gameInfo.character.isAccused++;
        currUsers[selectedUserIds[1]].gameInfo.character.isAccused++;

        alert(`被指控數量1 = ${selectedUserIds[0].gameInfo.character.isAccused} 被指控數量2 = ${selectedUserIds[0].gameInfo.character.isAccused}`)
        //
*/        
        const accuseUri = `/api/game/${this.props.gameInfo.id}/accuse`;

        const payLoad = {
            user: {
                id: selectedUserIds
            }
        };

        util.putRequest(accuseUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
        //顯示一下現在狀況(Debug用，實際玩不要開，會無法跳到下個環節)
        //alert(`currUsers = ${currUsers} currUser = ${currUser} selectedUserIds = ${selectedUserIds}`)
        
    }

    //隊長指定人施魔法
    /*giveMagic(){
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        const selectedUsers = this.props.gameInfo.users.reduce((result, currUser) => {
            if (currUser.gameInfo.selected) {
                result.push(currUser);
            }
            return result;
        }, []);

        if (selectedUsers.length !== 1) {
            this.setActionsAlert('Please select one player to give magic');
            return;
        }

        const requestUri = `/api/game/${this.props.gameInfo.id}/givemagic`;//可能待修
        const payLoad = {
            user: {
                id: selectedUser.id
            },
            requester: {
                id: currUser.id
            }
        };
        util.putRequest(requestUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }*/
    giveLady() {
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        const selectedUsers = this.props.gameInfo.users.reduce((result, currUser) => {
            if (currUser.gameInfo.selected) {
                result.push(currUser);
            }
            return result;
        }, []);

        if (selectedUsers.length !== 1) {
            this.setActionsAlert('Please select one player to investigate');
            return;
        }

        const selectedUser = selectedUsers[0];
        if (selectedUser.id === currUser.id) {
            this.setActionsAlert('You can not give lady card to yourself');
            return;
        }
        else if (selectedUser.gameInfo.hadLady) {
            this.setActionsAlert('This player used to own the lady card');
            return;
        }

        const requestUri = `/api/game/${this.props.gameInfo.id}/givelady`;
        const payLoad = {
            user: {
                id: selectedUser.id
            },
            requester: {
                id: currUser.id
            }
        };
        util.putRequest(requestUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    claimsGood(isGood) {
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        const selectedUsers = this.props.gameInfo.users.reduce((result, currUser) => {
            if (currUser.gameInfo.selected) {
                result.push(currUser);
            }
            return result;
        }, []);

        const selectedUser = selectedUsers[0];

        const requestUri = `/api/game/${this.props.gameInfo.id}/claimsgood`;
        const payLoad = {
            user: {
                id: selectedUser.id
            },
            requester: {
                id: currUser.id
            },
            isGood: isGood
        };
        util.putRequest(requestUri, payLoad).then(res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        });
    }

    reviewLadyResult() {
        const changeReadyUrl = `/api/game/${this.props.gameInfo.id}/changeuserstatus`;
        const currUser = this.getCurrentUser();

        let reviewStatus = 'Reviewed';
        if (currUser.gameInfo.status === 'Good' || currUser.gameInfo.status === 'Evil') {
            reviewStatus = `${currUser.gameInfo.status}.Reviewed`;
        }

        const payload = {
            user: {
                id: currUser.id,
                status: reviewStatus
            }
        };

        util.putRequest(changeReadyUrl, payload).then((res => {
            const changeRes = res.data;
            if (changeRes.changeResolved) {
                util.sendGameChanged();
            }
        }));
    }

    disableLadyReview() {
        const currUser = this.getCurrentUser();
        return currUser && (
            currUser.gameInfo.status === 'Reviewed' ||
            currUser.gameInfo.status === 'Good.Reviewed' ||
            currUser.gameInfo.status === 'Evil.Reviewed'
        );
    }

    getGameActions() {
        const game = this.props.gameInfo;
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        switch(game.status) {
        case 'Init': {
            if (currUser.id === this.props.gameInfo.creator) {
                return <Button text='Start' clickHandler={ this.startGame } />;
            }
            else {
                return <Button text={ (this.getReadyText()) } clickHandler={ this.readyGame } />;
            }
        }
        case 'Teaming': {
            if (currUser.gameInfo.leader) {
                return <Button text='Confirm Quest' clickHandler={ this.confirmTeaming } />;
            }
            else {
                return 'No actions needed. Please wait.';
            }
        }
        case 'Voting': {
            return  <div className='game-board--actions-button'>
                <Button text='Yes' theme='positive' clickHandler={ () => this.voteQuest(true) } isDisabled={ this.disableVoteButton() } />
                <Button text='No' theme='negative' clickHandler={ () => this.voteQuest(false) } isDisabled={ this.disableVoteButton() } />
            </div>;
        }
        case 'QuestGoing': {
            if (!currUser.gameInfo.selected) {
                return 'No actions needed. Please wait.';
            }
/*
            //被施魔法的人出不合心意的好壞杯
            //刺客被施魔法 只能出好杯
            //青年被施魔法 只能出壞杯
            else if(currUser.gameInfo.hasMagic && currUser.gameInfo.character.name === 'Assassin')  {
                return  <div className='game-board--actions-button'>
                    <Button text='Success' theme='positive' clickHandler={ () => this.successFailQuest(true) } isDisabled={ this.disableSuccessFailButton() } />
                </div>;
            }

            else if(currUser.gameInfo.hasMagic && currUser.gameInfo.character.name === 'young')  {
                return  <div className='game-board--actions-button'>
                <Button text='Fail' theme='negative' clickHandler={ () => this.successFailQuest(false) } isDisabled={ this.disableSuccessFailButton() } />
                </div>;
            }
*/
            else {
                return  <div className='game-board--actions-button'>
                    <Button text='Success' theme='positive' clickHandler={ () => this.successFailQuest(true) } isDisabled={ this.disableSuccessFailButton() } />
                    <Button text='Fail' theme='negative' clickHandler={ () => this.successFailQuest(false) } isDisabled={ this.disableSuccessFailButton() } />
                </div>;

            
            }
        }
        case 'GoodEnd': {
            return 'No actions needed. Good has won';
        }
        case 'EvilEnd': {
            return 'No actions needed. Evil has won';
        }
        //對應Status.js的STATUS
        case 'Assassinating': {
            const currRole = currUser.gameInfo.character;
            if (!currRole || currRole.name !== 'Assassin') {
                return 'No actions needed. Please wait for the Assasin';
            }
            else {
                return <Button text='Confirm' clickHandler={ this.assassinate } />; 
            }
        }
        //增加好人指認環節
        case 'Accusing':{
            const currRole = currUser.gameInfo.character;
            if (!currRole || currRole.isGood === false) {
                return 'No actions needed. Please wait for Good';
            }
            else {
                return <Button text='Confirm' clickHandler={ this.accuse } isDisabled={ this.disableAccuseButton() }/>;//如果已經指認過壞人了之後，按鈕失效 
            }
        }
        case 'Investigating': {
            if (!currUser.gameInfo.hasLady) {
                return 'No actions needed. Please wait';
            }
            else {
                return  <div className='game-board--actions-button'>
                    <Button text='Good' theme='positive' clickHandler={ () => this.claimsGood(true) } />
                    <Button text='Evil' theme='negative' clickHandler={ () => this.claimsGood(false) } />
                </div>;
            }
        }
        case 'Giving lady': {
            if (!currUser.gameInfo.hasLady) {
                return 'No actions needed. Please wait';
            }
            else {
                return <Button text='Give Lady' clickHandler={ this.giveLady } />;
            }
        }
        //增加隊長指派人施魔法環節
        // case 'Giving magic': {
        //     if (!currUser.gameInfo.leader) {
        //         return 'No actions needed. Please wait';
        //     }
        //     else {
        //         return <Button text='Give Magic' clickHandler={ this.giveMagic } />;
        //     }
        // }
        default: {
            return;
        }
        }
    }
    //控制選擇玩家的方形按鈕 影響按鈕按不按得下去
    playerCardSelectHandler(userObj) {
        const currUser = this.getCurrentUser();
        if (
            !currUser ||
            //原本的程式碼(this.props.gameInfo.status !== 'Teaming' && this.props.gameInfo.status !== 'Assassinating' && this.props.gameInfo.status !== 'Giving lady') ||
            //status不是Teaming、Assassinating、Accusing、GivingLady就不能按玩家方框按鈕
            (this.props.gameInfo.status !== 'Teaming' && this.props.gameInfo.status !== 'Assassinating' && this.props.gameInfo.status !== 'Accusing' && this.props.gameInfo.status !== 'Giving lady') ||
            (this.props.gameInfo.status === 'Teaming' && !currUser.gameInfo.leader) ||
            (this.props.gameInfo.status === 'Assassinating' && (currUser && currUser.gameInfo.character.name !== 'Assassin')) ||
            (this.props.gameInfo.status === 'Accusing' && (currUser && currUser.gameInfo.character.isGood !== true)) ||//如果是在Accusing的階段，但目前玩家不是好角色就不能點玩家的方形按鈕
            (this.props.gameInfo.status === 'Accusing' && (currUser && currUser.gameInfo.hasAccused === true)) ||//如果是在Accusing的階段，但目前玩家已經指控過了，就不能點玩家的方形按鈕
            (this.props.gameInfo.status === 'Giving lady' && (currUser && !currUser.gameInfo.hasLady))
            //||(this.props.gameInfo.status === 'Giving magic' && (currUser && !currUser.gameInfo.leader))//如果是在Giving magic的階段，但目前玩家不是隊長就不能點玩家的方形按鈕
        ) {
            return;
        }

        this.clearActionsAlert();
        userObj.gameInfo.selected = !userObj.gameInfo.selected;
        this.props.changeGameHandler(this.props.gameInfo);
    }
    //控制選擇Quest的圓形按鈕 影響按鈕按不按得下去
    questSelectHandler(quest) {
        const currUser = this.getCurrentUser();
        if (
            !currUser ||
            //原程式碼(this.props.gameInfo.status !== 'Teaming' && this.props.gameInfo.status !== 'Assassinating') ||
            (this.props.gameInfo.status !== 'Teaming' && this.props.gameInfo.status !== 'Assassinating' && this.props.gameInfo.status !== 'Accusing')||
            (this.props.gameInfo.status === 'Teaming' && !currUser.gameInfo.leader) ||
            (this.props.gameInfo.status === 'Assassinating' && (currUser && currUser.gameInfo.character.name !== 'Assassin')) ||
            (this.props.gameInfo.status === 'Accusing' && (currUser && currUser.gameInfo.character.isGood !== true)) ||//如果是在Accusing的階段，但目前玩家不是好角色就不能點Quest的按鈕
            quest.status === 'Success' ||
            quest.status === 'Failed'
        ) {
            return;
        }

        this.clearActionsAlert();
        quest.selected = !quest.selected;
        this.props.changeGameHandler(this.props.gameInfo);
    }

    openLeaveGameModal() {
        this.setState({
            leaveGameModalOpen: true
        });
    }

    closeLeaveGameModal() {
        this.setState({
            leaveGameModalOpen: false
        });
    }

    leaveGameModalConfirm() {
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return;
        }

        if (currUser.id === this.props.gameInfo.creator) {
            this.creatorBackToLobby();
        }
        else {
            this.playerBackToLobby();
        }
    }

    openGameBrokenNoticeModal() {
        this.setState({
            gameBrokenNoticeModalOpen: true
        });
    }

    closeGameBrokenNoticeModal() {
        this.setState({
            gameBrokenNoticeModalOpen: false
        });
    }

    gameBrokenNoticeModalConfirm() {
        this.props.history.push('/lobby');
    }

    getLeaveGameModalText() {
        const currUser = this.getCurrentUser();
        if (!currUser) {
            return '';
        }

        if (currUser.id === this.props.gameInfo.creator) {
            return 'This game will be deleted if you leave now. Please confirm.';
        }

        if (
            this.props.gameInfo.status !== 'Init' &&
            this.props.gameInfo.status !== 'GoodEnd' &&
            this.props.gameInfo.status !== 'EvilEnd'
        ) {
            return 'The game is started but not done. If you leave now, the game will be deleted.';
        }
        else {
            return 'You want to leave the game?';
        }
    }

    hasCountDown() {
        const currUser = this.getCurrentUser();
        const currGameStatus = this.props.gameInfo.status;
        if (!currUser || !currGameStatus || !currUser.gameInfo) {
            return false;
        }

        const countDownStatuses = {
            'QuestReview': true,
            'Review': true,
            'LadyReview': true
        };

        return countDownStatuses[currGameStatus] && (currUser.gameInfo.status.indexOf('Reviewed') === -1 && currUser.gameInfo.status.indexOf('Ready') === -1);
    }

    setUpCountDown() {
        const self = this;

        if (!self.hasCountDown() || self.state.countDownId || self.state.countDown === 0) {
            return;
        }

        const timerId = setInterval(() => {
            const currCountDown = self.state.countDown;
            if (currCountDown == 0) {
                clearInterval(timerId);
                self.dispatchCountDownEvent();
                self.setState({
                    countDownId: null
                });
                return;
            }

            self.setState({
                countDown: currCountDown - 1,
                countDownId: timerId
            });
        }, 1000);
    }

    dispatchCountDownEvent() {
        const currGameStatus = this.props.gameInfo.status;
        const dispatchMap = {
            'QuestReview': this.reviewQuest,
            'Review': this.readyReview,
            'LadyReview': this.reviewLadyResult
        };

        const action = dispatchMap[currGameStatus];
        if (!action) {
            return;
        }

        action.apply(this);
    }

    render() {
        return (
            <div className='col-10 game-board'>
                <Card title='GameBoard'>
                    <div className='game-board--name'>
                        { this.props.gameInfo.name }
                    </div>
                    {
                        this.props.gameInfo.status === 'Init' ?
                            <div className='game-board--summary'>
                                { this.getGameSummary() }
                            </div>
                            :
                            <div className='game-board--notice animated shake'>
                                <span className='game-board--notice-header'>Notice:</span>
                                { this.getNotice() }
                            </div>
                    }
                    {
                        this.props.gameInfo.status === 'Init' && 
                        <div className='game-board--alert'>
                            <span>{ this.state.alertText }</span>
                        </div>
                    }
                    <div className='game-board--leave-button'>
                        <Button text='Leave' theme='cancel' clickHandler={ this.openLeaveGameModal }/>
                    </div>
                    <div className='game-board--actions'>
                        <div className='game-board--actions-text'>Game Actions</div>
                        { this.getGameActions() }
                        {
                            this.hasCountDown() &&
                            <div className='game-board--countdown'>
                                Moving forward in:<span className='game-board--countdown-number'>{this.state.countDown}</span>seconds
                            </div>
                        }
                        <div className='game-board--actions-alert'>{ this.state.actionsAlert }</div>
                    </div>
                    <div className='game-board--users'>
                        <div className='game-board--users-header'>Players: </div>
                        {
                            this.props.gameInfo.users.map((user, i) =>
                                <PlayerCard key={ `k${i}` } user={ user } clickHandler={ () => this.playerCardSelectHandler(user) } />
                            )
                        }
                    </div>
                    {
                        this.props.gameInfo.status !== 'Init' &&
                        <div className='game-board--quest-board'>
                            <div className='game-board--quests'>
                                <QuestBoard gameInfo={ this.props.gameInfo } clickHandler={ this.questSelectHandler } />
                            </div>
                        </div>
                    }
                    {
                        this.props.gameInfo.status !== 'Init' && this.props.gameInfo.history.length > 0 &&
                        <div className='game-board--history'>
                            <div className='game-board--history-header'>Quest History</div>
                            {
                                this.props.gameInfo.history.map((historyEntry, i) =>
                                    <div key={ i }>
                                        { historyEntry }
                                    </div>
                                )
                            }
                        </div>
                    }
                    {
                        this.props.gameInfo.status !== 'Init' &&
                        <div className='game-board--character'>
                            <CharacterCard user={ this.getCurrentUser() } users={ this.props.gameInfo.users } />
                        </div>
                    }
                </Card>
                {
                    this.state.leaveGameModalOpen &&
                    <Portal>
                        <Modal
                            title='Leave game'
                            buttonText='Confirm'
                            closeHandler={ this.closeLeaveGameModal }
                            confirmHandler={ this.leaveGameModalConfirm }
                        >
                            { this.getLeaveGameModalText() }
                        </Modal>
                    </Portal>
                }
                {
                    this.state.gameBrokenNoticeModalOpen &&
                    <Portal>
                        <Modal
                            title='Player or creator left'
                            buttonText='OK'
                            closeHandler={ this.gameBrokenNoticeModalConfirm }
                            confirmHandler={ this.gameBrokenNoticeModalConfirm }
                        >
                            The creator or one of the players has left the game
                        </Modal>
                    </Portal>
                }
            </div>
        );
    }
}
