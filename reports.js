const express = require("express");
const router = express.Router();
const db = require("../models");
const Reports = db.reports;
const Commits = db.commits;
const Products = db.products;

/**
 * 신고등록하기
 * 댓글/답글 신고하기
 */
router.all("/commit-add", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 신고하기");
        if ( !req.body.commit_id )
            return res.status(200).json({ status: false, msg: [ '신고할 댓글을 선택하세요' ] });

        let temp = await Commits.findOne({
            where: {
                id: Number( req.body.commit_id ),
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['신고요청된 댓글은 존재하지 않습니다']});
        else if ( temp.user_id === req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님의 작성글에 대해서는 신고하기가 불가입니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의해 비노출상태에 있는 댓글입니다']});

        await Reports.create({
            user_id: req.body.jwt_data.id,
            commit_id: Number( req.body.commit_id ),
            created: new Date().toUTCString(),
        });
        return res.status(200).json({ status: true, msg: ['신고가 성공적으로 접수되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
/**
 * 함께해요에 신고하기
 */
router.all("/together-add", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 신고하기");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: [ '신고할 함께해요를 선택하세요' ] });

        let temp = await Products.findOne({
            where: {
                id: Number( req.body.product_id ),
                product_role: "together",
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['신고요청된 함께해요는 존재하지 않습니다']});
        else if ( temp.user_id === req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님의 작성글에 대해서는 신고하기가 불가입니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});

        await Reports.create({
            user_id: req.body.jwt_data.id,
            product_id: Number( req.body.product_id ),
            created: new Date().toUTCString(),
        });
        return res.status(200).json({ status: true, msg: ['신고가 성공적으로 접수되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
/**
 * 신고해지하기 by Admin
 */
router.all("/cancel", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 신고해지하기 ");
        if ( req.body.jwt_data.role !== "admin" )
            return res.status( 200 ).json({ status: false, msg : ['고객님의 권한으로는 이 요청을 하실수 없습니다']});

        if ( !req.body.report_ids )
            return res.status(200).json({ status: false, msg: ['신고해지하려는 레코드들을 선택하세요']});

        await Reports.update({
            deleted: new Date().toUTCString(),
            created: null,
        }, {
            where: {
                id: req.body.report_ids,
            }
        });
        return res.status(200).json({ status: true, msg: ['신고가 성공적으로 해지되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
module.exports = router;