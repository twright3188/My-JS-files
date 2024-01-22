const express = require("express");
const router = express.Router();
const db = require("../models");
const Invites = db.invites;
const Users = db.users;
const generateInviteCode = require("../utils/generateInviteCode");
/**
 * 초대코드 발행
 * 필요한 입력파라미터 없음
 */
router.all("/get-code", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 초대코드 발행 및 등록하기 ");
        let flag;
        let code;
        do {
            code = generateInviteCode();
            if ( code.status ) {
                let temp = await Invites.findOne({
                    where: {
                        code: code.results,
                    }
                });
                flag = !temp;
            } else
                flag = false;
        } while ( !flag );
        await Invites.create({
            user_id: req.body.jwt_data.id,
            code: code.results,
            created: new Date(),
        });
        return res.status(200).json({ status: true, results: code.results });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
/**
 * 받은 초대코드 입력하여 등록하기
 */
router.all("/check-code", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 받은 초대코드 입력하여 등록하기 ");
        if ( !req.body.code || ( req.body.code && req.body.code.length !== 6 ) )
            return res.status(200).json({ status: false, msg: ['초대코드를 정확하게 입력하세요']});
        let temp = await Invites.findOne({
            where: {
                code: req.body.code,
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['등록된 코드가 아닙니다']});
        else if ( temp.used )
            return res.status(200).json({ status: false, msg: ['이미 이용된 코드입니다']});
        else if ( temp.user_id === req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님이 신청하여 발행한 코드로는 등록하실수 없습니다']});
        else {
            // 이미 같은 회원으로부터 초대받아 등록된 회원인가를 체크하기
            let check_invite = await Invites.findOne({
                where: {
                    invited_user_id: req.body.jwt_data.id,
                }
            });
            if ( check_invite )
                return res.status(200).json({ status: false, msg: ['고객님은 이미 다른 코드를 이용하셨습니다']});
            // 회원으로 등록한 날짜와 코드발행날짜 비교하기
            let user = await Users.findOne({
                where: {
                    id: req.body.jwt_data.id,
                },
                attributes: ['created'],
            });
            if ( new Date( user.created).getTime() <= new Date( temp.created ).getTime() )
                return res.status(200).json({ status: false, msg: ['고객님은 이 코드를 받으시기전에 이미 등록된 회원이었기때문에 코드를 이용하실수 없습니다']});
            console.log( new Date( user.created).getTime(), new Date( temp.created ).getTime() );
            await Invites.update({
                invited_user_id: req.body.jwt_data.id,
                used: new Date().toUTCString(),
            }, {
                where: {
                    code: req.body.code,
                }
            });
            return res.status(200).json({ status: true, msg: ['초대코드가 정확히 확인되었습니다'] });
        }
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
module.exports = router;