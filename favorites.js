const express = require("express");
const router = express.Router();
const db = require("../models");
const Products = db.products;
const Favorites = db.favorites;

/**
 * 관심중 클릭
 */
router.all("/update", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 관심중 업뎃하기 ");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 공구를 선택하세요.']});
        let temp = await Products.findOne({
            where: {
                id: Number( req.body.product_id ),
                deleted: null,
                active_state: true,
                // state: 1,           //진행중에 있는 공구 필터하기
                active_state: true, // 관리자에 의하여 비노출상태로 있지 않는지 체크하기
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 공구이거나 잘못된 요청입니다']});
        else if ( temp.user_id === req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님이 올린 상품에 대한 하트 클릭이벤트는 적용되지 않습니다']});
        temp = await Favorites.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
            },
            attributes: ['id', 'state'],
        });
        let flag;
        if ( !temp ) {
            await Favorites.create({
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
                state: true,
                created: new Date().toUTCString(),
            });
            flag = true;
        }
        else {
            await Favorites.update({
                state: !temp.state,
                updated: new Date().toUTCString(),
            }, {
                where: {
                    id: temp.id,
                }
            });
            flag = !temp.state;
        }
        return res.status(200).json({ status: true, results: flag });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()] });
    }
});
module.exports = router;