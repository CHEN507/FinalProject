import React from 'react';
import PropTypes from 'prop-types';
import '../css/button.scss';

export default class Button extends React.Component {
    static get propTypes() {
        return {
            theme: PropTypes.string,
            text: PropTypes.string,
            clickHandler: PropTypes.func, //clickHandler{裡面放函式} 表示按鈕點擊後會執行的動作
            isDisabled: PropTypes.bool //isDisabled{裡面放布林值} 如果布林值=true 按鈕失效
        };
    }

    getClassName() {
        const themes = {
            'default': 'btn btn-default',
            'cancel': 'btn btn-cancel',
            'action': 'btn btn-action',
            'negative': 'btn btn-negative',
            'positive': 'btn btn-positive'
        };

        if (themes[this.props.theme]) {
            return themes[this.props.theme];
        }
        else {
            return themes['default'];
        }
    }

    render() {
        return (
            <button
                className={ this.getClassName() }
                onClick={ this.props.clickHandler }
                disabled={ this.props.isDisabled }
            >
                { this.props.text }
            </button>
        );
    }
}
